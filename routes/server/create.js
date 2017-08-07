const _ = require("koa-route");
const Server = require("../../lib/Server");

module.exports = _.put("/server", async ctx => {
	const server = await Server.create(ctx.request.body);

	ctx.body = server;
});
