const yup = require("yup");
const redis = require("./redis");

const schema = yup.object().shape({
	name: yup.string().required(),
	repo: yup.string().required(),
	servers: yup.array().of(yup.number().positive().integer()).required(),
	directory: yup.string().required(),
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
