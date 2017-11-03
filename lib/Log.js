const yup = require("yup");
const redis = require("./redis");

module.exports = Log;

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
};
