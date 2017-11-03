const yup = require("yup");
const redis = require("./redis");
const Project = require("./Project");

class Log {
	constructor(projectId) {
		this.id = undefined;
		this.projectId = projectId;
		this.status = "pending";
	}

	async push() {
		if(this.id == undefined) {
			this.id = await redis.incr("log:id");

			await redis.set(`log:instance:${this.id}:projectId`, this.projectId);
			await redis.set(`log:instance:${this.id}:status`, this.status);

			await redis.lpush("log:instances", this.id);
		}

		const line = [ ...arguments ].map(a => a.toString()).join(" ");

		await redis.append(`log:instance:${this.id}`, `${line}\n`);
	}

	async failed() {
		if(this.status != "pending") {
			throw new Error("Status already set!");
		}

		await redis.set(`log:instance:${this.id}:status`, "failed");
	}

	async succeeded() {
		if(this.status != "pending") {
			throw new Error("Status already set!");
		}

		await redis.set(`log:instance:${this.id}:status`, "succeeded");
	}

	static async top() {
		return await redis.get("log:id");
	}

	static async find(id) {
		return {
			projectId: await redis.get(`log:instance:${id}:projectId`),
			text: await redis.get(`log:instance:${id}`) || "",
			status: await redis.get(`log:instance:${id}:status`)
		};
	}
};

module.exports = Log;
