const _ = require("koa-route");
const Project = require("../../lib/Project");

module.exports = _.put("/project", async ctx => {
	const project = await Project.create(ctx.request.body);

	ctx.body = project;
});
