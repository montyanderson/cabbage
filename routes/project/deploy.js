const _ = require("koa-route");
const Project = require("../../lib/Project");

module.exports = _.post("/project/deploy", async ctx => {
	const project = await Project.find(ctx.query.id);

	ctx.body = await project.deploy();
});
