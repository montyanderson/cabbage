const yup = require("yup");
const redis = require("./redis");

const schema = yup.object().shape({
	name: yup.string().required(),
	address: yup.string().required(),
	port: yup.number().required().positive().integer(),
	username: yup.string().required(),
	password: yup.string().required(),
	id: yup.number().strip()
}).noUnknown();

class Server {
	constructor(server) {
		Object.assign(this, server);
	}

	async save() {
		if(this.id == undefined) {
			this.id = await redis.incr("server:id");
		}

		const obj = schema.cast(Object.assign({}, this));

		await schema.validate(obj);

		await redis.multi()
			.sadd("server:instances", this.id)
			.set(`server:instance:${this.id}`, JSON.stringify(obj))
			.exec();
	}

	static async create(input) {
		const server = new Server(input);
		await server.save();

		return server;
	}

	static async find(id) {
		const json = await redis.get(`server:instance:${id}`);

		if(typeof json !== "string") {
			throw new Error(`Server '${id}' does not exist`);
		}

		const server = JSON.parse(json);
		server.id = id;

		return new Server(server);
	}

	static async list() {
		const ids = await redis.smembers("server:instances");
		return Promise.all(ids.map(id => Server.find(id)));
	}

	static async delete(id) {
		await redis.multi()
			.srem("server:instances", id)
			.del(`server:instance:${id}`)
			.exec();
	}
};

module.exports = Server;
