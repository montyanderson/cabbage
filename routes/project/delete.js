const _ = require("koa-route");
const Project = require("../../lib/Project");

module.exports = _.get("/project/delete", async ctx => {
	await Project.delete(ctx.query.id);

	ctx.body = {};
});
