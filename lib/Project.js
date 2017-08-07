const fs = require("mz/fs");
const crypto = require("crypto");
const yup = require("yup");
const execa = require("execa");
const redis = require("./redis");
const Server = require("../lib/Server");

const schema = yup.object().shape({
	name: yup.string().required(),
	repo: yup.string().required(),
	servers: yup.array().of(yup.number().positive().integer()).required(),
	directory: yup.string().required(),
	active: yup.bool().required(),
	id: yup.number().strip()
});

class Project {
	constructor(project) {
		Object.assign(this, project);
	}

	async save() {
		const obj = schema.cast(Object.assign({}, this));

		await schema.validate(obj);

		await redis.multi()
			.zremrangebyscore("project:repos", this.id, this.id)
			.zadd("project:repos", this.id, obj.repo)
			.set(`project:instance:${this.id}`, JSON.stringify(obj))
			.exec();
	}

	static async create(input) {
		const id = await redis.incr("project:id");
		await redis.sadd("project:instances", id);

		const project = new Project(Object.assign({}, input, { id }));
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
			.del(`project:instance:${id}`)
			.exec();
	}

	async deploy() {
		const project = this;

		const directory = `/tmp/${crypto.randomBytes(32).toString("hex")}`;
		await fs.mkdir(directory);

		const git = await execa("git", [ "clone", `https://github.com/${project.repo}`, directory ]);

		const cabbageFilePath = `${directory}/.cabbage`;

		try {
			await fs.access(cabbageFilePath);
			await execa(`chmod`, [ "+x", cabbageFilePath ]);

			await execa.shell(`${cabbageFilePath}`, {
				cwd: directory
			});
		} catch(error) {
			// .cabbage file not found
		};

		const servers = await Promise.all(project.servers.map(id => Server.find(id)));

		const scp = [];

		// sanitize
		const projectDirectory = project.directory.replace(new RegExp(`"`, "g"), `\\"`);

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

			const files = (await fs.readdir(directory))
				.filter(f => f !== ".git")
				.map(f => `${directory}/${f}`);

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
