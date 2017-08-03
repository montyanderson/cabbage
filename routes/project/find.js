const _ = require("koa-route");
const Project = require("../../lib/Project");

module.exports = _.get("/project/find", async ctx => {
	const project = await Project.find(ctx.query.id);

	ctx.body = Project;
});
