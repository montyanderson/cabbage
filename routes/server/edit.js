const _ = require("koa-route");
const Server = require("../../lib/Server");

module.exports = _.post("/server", async ctx => {
	const server = new Server(ctx.request.body);

	await server.save();

	ctx.body = server;
});
