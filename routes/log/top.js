const _ = require("koa-route");
const Log = require("../../lib/Log");

module.exports = _.get("/log/top", async ctx => {
	ctx.body = await Log.top();
});
