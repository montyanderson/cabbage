const _ = require("koa-route");
const Project = require("../../lib/Project");

module.exports = _.delete("/project", async ctx => {
	await Project.delete(ctx.query.id);

	ctx.body = {};
});
