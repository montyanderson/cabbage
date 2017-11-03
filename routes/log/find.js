const _ = require("koa-route");
const Log = require("../../lib/Log");

module.exports = _.get("/log", async ctx => {
	ctx.body = await Log.find(ctx.query.id);
});
