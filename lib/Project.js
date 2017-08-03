const redis = require("./redis");

class Project {
	constructor(project) {
		Object.assign(this, project);
	}

	async save() {
		const obj = Object.assign({}, this);
		const id = this.id;

		obj.id = undefined;

		await redis.multi()
			.zremrangebyscore("project:repos", id, id)
			.zadd("project:repos", id, obj.repo)
			.set(`project:instance:${id}`, JSON.stringify(obj))
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
		const project = JSON.parse(await redis.get(`project:instance:${id}`));
		project.id = id;

		return new Project(project);
	}

	static async findByRepo(repo) {
		const id = await redis.zscore("project:repos", repo);
		return await Project.find(id);
	}

	static async list() {
		const ids = await redis.smembers("project:instances");
		return Promise.all(ids.map(id => Project.find(id)));
	}

	static async delete(id) {
		await redis.multi()
			.srem("project:instances", id)
			.del(`project:instance:${id}`)
			.exec();
	}
};

module.exports = Project;
