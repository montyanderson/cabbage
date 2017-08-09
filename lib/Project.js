const fs = require("mz/fs");
const crypto = require("mz/crypto");
const yup = require("yup");
const execa = require("execa");
const Minimatch = require("minimatch").Minimatch;
const redis = require("./redis");
const Server = require("../lib/Server");
const github = require("../.github");

const schema = yup.object().shape({
	name: yup.string().required(),
	repo: yup.string().required(),
	servers: yup.array().of(yup.number().positive().integer()).min(0).required(),
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

	async deploy({ added = [], removed = [], modified = [] } = {}) {
		const project = this;
		console.log(`Deploy for project '${project.name}' at '${project.repo}' started`);

		console.log("Added files:", added);
		console.log("Removed files:", removed);
		console.log("Modified files:", modified);

		const directory = `/tmp/${(await crypto.randomBytes(32)).toString("hex")}`;

		console.log(`Creating directory '${directory}'`);
		await fs.mkdir(directory);

		const repoUrl = `https://${github.username}:${github.password}@github.com/${project.repo}`;

		console.log(`Cloning git repository '${repoUrl}'`);
		const git = await execa("git", [ "clone", repoUrl, directory ]);

		const cabbageFilePath = `${directory}/.cabbage`;
		console.log(`Attempting to find .cabbage file '${cabbageFilePath}'`);

		try {
			await fs.access(cabbageFilePath);
			await execa(`chmod`, [ "+x", cabbageFilePath ]);

			await execa.shell(`${cabbageFilePath}`, {
				cwd: directory
			});
		} catch(error) {
			// .cabbage file not found
			console.log(`.cabbage file not found`);
		};

		const cabbageIgnorePath = `${directory}/.cabbageignore`;
		console.log(`Attempting to find .cabbageignore file '${cabbageIgnorePath}'`);

		let ignore = [];

		try {
			ignore = (await fs.readFile(cabbageIgnorePath, "utf8"))
				.split("\n")
				.filter(a => !!a)
				.map(a => new Minimatch(a));
		} catch(error) {
			// console.log(error);
			// .cabbageignore file not found
		}

		console.log(`Loading servers from redis:`, project.servers);
		const servers = await Promise.all(project.servers.map(id => Server.find(id)));

		const scp = [];

		// sanitize
		const projectDirectory = project.directory.replace(new RegExp(`"`, "g"), `\\"`);

		let files = [ ...added, ...modified ];
		console.log(`Files to copy:`, files);

		if(files.length === 0) {
			console.log(`Copying ALL files due to none being specified`);
			files = await fs.readdir(directory);
			console.log(`Files found:`, files);
		}

		files = files
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

		console.log(`Files filtered and morphed:`, files);

		await Promise.all(servers.map(async (server, i) => {

			let cmd;

			if(removed.length > 0) {
				cmd = `rm -rf ${removed.map(f => `"${projectDirectory}/${f}"`).join(" ")}`

				console.log(`ssh: ${cmd}`);

				await execa("sshpass", [
					"-e",
					"ssh",
					"-o",
					"UserKnownHostsFile=/dev/null",
					"-o",
					"StrictHostKeyChecking=no",
					"-p",
					server.port,
					`${server.username}@${server.address}`,
					cmd
				], {
					env: {
						SSHPASS: server.password
					}
				});
			}

			cmd = `mkdir -p "${projectDirectory}"`;

			console.log(`ssh: ${cmd}`);

			await execa("sshpass", [
				"-e",
				"ssh",
				"-o",
				"UserKnownHostsFile=/dev/null",
				"-o",
				"StrictHostKeyChecking=no",
				"-p",
				server.port,
				`${server.username}@${server.address}`,
				cmd
			], {
				env: {
					SSHPASS: server.password
				}
			});

			console.log(`Copying files to ${server.username}@${server.address}:${projectDirectory}`);

			scp[i] = await execa("sshpass", [
				"-e",
				"scp",
				"-o",
				"UserKnownHostsFile=/dev/null",
				"-o",
				"StrictHostKeyChecking=no",
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

			console.log(`Coppied files to ${server.username}@${server.address}`);

		}));

		return `Deployment of files ${files.map(f => JSON.stringify(f.split("/").pop())).join(", ")} to servers ${servers.map(s => JSON.stringify(s.name)).join(", ")} complete.`;
	}
};

module.exports = Project;
