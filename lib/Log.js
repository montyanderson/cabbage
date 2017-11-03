const yup = require("yup");
const redis = require("./redis");

class Log {
	constructor() {
		this.id = undefined;
	}

	async push() {
		if(this.id == undefined) {
			this.id = await redis.incr("log:id");
			await redis.lpush("log:instances", this.id);
		}

		const line = [ ...arguments ].map(a => a.toString()).join(" ");

		await redis.append(`log:instance:${this.id}`, `${line}\n`);
	}

	static async top() {
		return await redis.get("log:id");
	}

	static async find(id) {
		return {
			id,
			text: await redis.get(`log:instance:${this.id}`)
		};
	}
};

module.exports = Log;
