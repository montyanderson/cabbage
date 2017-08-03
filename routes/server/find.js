const _ = require("koa-route");
const Server = require("../../lib/Server");

module.exports = _.get("/server/find", async ctx => {
	const server = await Server.find(ctx.query.id);

	ctx.body = server;
});
