const _ = require("koa-route");
const Server = require("../../lib/Server");

module.exports = _.get("/server/delete", async ctx => {
	await Server.delete(ctx.query.id);

	ctx.body = {};
});
