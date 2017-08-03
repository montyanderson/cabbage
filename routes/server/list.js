const _ = require("koa-route");
const Server = require("../../lib/Server");

module.exports = _.get("/server/list", async ctx => {
	ctx.body = await Server.list();
});
