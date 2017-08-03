const _ = require("koa-route");
const Project = require("../../lib/Project");

module.exports = _.post("/project/create", async ctx => {
	console.log(ctx.request.body);
	const project = await Project.create(ctx.request.body);

	ctx.body = project;
});
