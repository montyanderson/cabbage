const redis = require("./redis");

class Server {
	constructor(server) {
		Object.assign(this, server);
	}

	save() {
		const obj = Object.assign({}, this);
		const id = this.id;

		obj.id = undefined;

		redis.set(`server:instance:${id}`, JSON.stringify(obj));
	}

	static async create(input) {
		const id = await redis.incr("server:id");
		await redis.sadd("server:instances", id);

		const server = new Server(Object.assign({}, input, { id }));
		await server.save();

		return server;
	}

	static async find(id) {
		const server = JSON.parse(await redis.get(`server:instance:${id}`));
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
