const fs = require("mz/fs");
const crypto = require("mz/crypto");
const yup = require("yup");
const execa = require("execa");
const Minimatch = require("minimatch").Minimatch;
const redis = require("./redis");
const Server = require("../lib/Server");

const schema = yup.object().shape({
	name: yup.string().required(),
	repo: yup.string().required(),
	servers: yup.array().of(yup.number().positive().integer()).required(),
	directory: yup.string().required(),
	active: yup.bool().required(),
	pushSecret: yup.string().required(),
	id: yup.number().strip()
});

class Project {
	constructor(project) {
		Object.assign(this, project);
	}

	async save() {
		if(this.id == undefined) {
			this.id = await redis.incr("project:id");
		}

		const obj = schema.cast(Object.assign({}, this));

		await schema.validate(obj);

		await redis.multi()
			.sadd("project:instances", this.id)
			.zremrangebyscore("project:repos", this.id, this.id)
			.zadd("project:repos", this.id, obj.repo)
			.set(`project:instance:${this.id}`, JSON.stringify(obj))
			.exec();
	}

	static async create(input) {
		const project = new Project(input);

		project.pushSecret = (await crypto.randomBytes(32)).toString("base64").slice(0, -1);
		await project.save();

		return project;
	}

	static async find(id) {
		const json = await redis.get(`project:instance:${id}`);

		if(typeof json !== "string") {
			throw new Error(`Project ${id} does not exist`);
		}

		const project = JSON.parse(json);
		project.id = id;

		return new Project(project);
	}

	static async findByRepo(repo) {
		const id = await redis.zscore("project:repos", repo);
		return await Project.find(id);
	}

	static async list() {
		const ids = await redis.smembers("project:instances");
		return await Promise.all(ids.map(id => Project.find(id)));
	}

	static async delete(id) {
		await redis.multi()
			.srem("project:instances", id)
			.zremrangebyscore("project:repos", this.id, this.id)
			.del(`project:instance:${id}`)
			.exec();
	}

	async deploy() {
		const project = this;

		const directory = `/tmp/${(await crypto.randomBytes(32)).toString("hex")}`;
		await fs.mkdir(directory);

		const git = await execa("git", [ "clone", `git@github.com://github.com/${project.repo}.git`, directory ]);

		const cabbageFilePath = `${directory}/.cabbage`;

		try {
			await fs.access(cabbageFilePath);
			await execa(`chmod`, [ "+x", cabbageFilePath ]);

			await execa.shell(`${cabbageFilePath}`, {
				cwd: directory
			});
		} catch(error) {
			// .cabbage file not found
			console.log(error);
		};

		const cabbageIgnorePath = `${directory}/.cabbageignore`;

		let ignore = [];

		try {
			ignore = (await fs.readFile(cabbageIgnorePath, "utf8"))
				.split("\n")
				.filter(a => !!a)
				.map(a => new Minimatch(a));
		} catch(error) {
			console.log(error);
			// .cabbageignore file not found
		}

		const servers = await Promise.all(project.servers.map(id => Server.find(id)));

		const scp = [];

		// sanitize
		const projectDirectory = project.directory.replace(new RegExp(`"`, "g"), `\\"`);

		const files = (await fs.readdir(directory))
			.filter(f => f !== ".git" && f !== ".cabbage" && f !== ".cabbageignore")
			.filter(f => {
				for(let m of ignore) {
					if(m.match(f) === true) {
						return false;
					}
				}

				return true;
			})
			.map(f => `${directory}/${f}`);

		if(files.length < 1) {
			throw new Error("No files found to copy!");
		}

		await Promise.all(servers.map(async (server, i) => {

			await execa("sshpass", [
				"-e",
				"ssh",
				"-p",
				server.port,
				`${server.username}@${server.address}`,
				`rm -rf "${projectDirectory}"/*`
			], {
				env: {
					SSHPASS: server.password
				}
			});

			await execa("sshpass", [
				"-e",
				"ssh",
				"-p",
				server.port,
				`${server.username}@${server.address}`,
				`mkdir -p "${projectDirectory}"`
			], {
				env: {
					SSHPASS: server.password
				}
			});

			scp[i] = await execa("sshpass", [
				"-e",
				"scp",
				"-P",
				server.port,
				"-r",
				...files,
				`${server.username}@${server.address}:${projectDirectory}`
			], {
				env: {
					SSHPASS: server.password
				}
			});

		}));

		return {
			git: {
				stdout: git.stdout,
				stderr: git.stderr
			},
			scp: scp.map(s => ({
				stdout: s.stdout,
				stderr: s.stderr
			}))
		};
	}
};

module.exports = Project;
