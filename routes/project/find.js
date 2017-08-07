const _ = require("koa-route");
const Project = require("../../lib/Project");

module.exports = _.get("/project", async ctx => {
	const project = await Project.find(ctx.query.id);

	ctx.body = project;
});
