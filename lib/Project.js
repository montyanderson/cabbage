const redis = require("./redis");

class Project {
	constructor(project) {
		Object.assign(this, project);
	}

	save() {
		const obj = Object.assign({}, this);
		const id = this.id;

		obj.id = undefined;

		redis.set(`project:instance:${id}`, JSON.stringify(obj));
	}

	static async create(input) {
		const id = await redis.incr("project:id");
		await redis.sadd("project:instances", id);

		const project = new Project(Object.assign({}, input, { id }));
		await projet.save();

		return project;
	}

	static async find(id) {
		const project = JSON.parse(await redis.get(`project:instance:${id}`));
		project.id = id;

		return new Project(project);
	}

	static async list() {
		const ids = await redis.smembers("project:instances");
		return Promise.all(ids.map(id => Project.find(id)));
	}

	static async delete(id) {
		await redis.srem("project:instances", id);
		await redis.del(`project:instance:${id}`);
	}
};

module.exports = Project;
