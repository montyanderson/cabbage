const _ = require("koa-route");
const Project = require("../../lib/Project");

module.exports = _.post("/project/edit", async ctx => {
	const project = new Project(ctx.request.body);

	await project.save();

	ctx.body = project;
});
