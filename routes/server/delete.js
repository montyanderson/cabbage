const _ = require("koa-route");
const Server = require("../../lib/Server");

module.exports = _.delete("/server", async ctx => {
	await Server.delete(ctx.query.id);

	ctx.body = {};
});
