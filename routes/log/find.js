const _ = require("koa-route");
const log = require("../../lib/Log");

module.exports = _.get("/log", async ctx => {
	const log = await Log.find(ctx.query.id);

	ctx.body = log;
});
