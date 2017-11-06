const path = require("path");
const fs = require("mz/fs");
const crypto = require("mz/crypto");
const yup = require("yup");
const execa = require("execa");
const Minimatch = require("minimatch").Minimatch;
const redis = require("./redis");
const Server = require("../lib/Server");
const github = require("../.github");
const deploy = require("./deploy");

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

	async deploy() {
		return deploy.apply(this, arguments);
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
};

module.exports = Project;
