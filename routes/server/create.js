const _ = require("koa-route");
const Server = require("../../lib/Server");

module.exports = _.post("/server/create", async ctx => {
	const server = await Server.create(ctx.request.body);

	ctx.body = server;
});
