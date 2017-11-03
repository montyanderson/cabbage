const _ = require("koa-route");
const log = require("../../lib/Log");

module.exports = _.get("/log", async ctx => {
	ctx.body = await Log.find(ctx.query.id);
});
