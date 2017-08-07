const _ = require("koa-route");
const fs = require("mz/fs");
const Project = require("../lib/Project");

const secret = fs.readFileSync(__dirname + "/../.push_secret", "utf8").trim();

module.exports = _.post("/push", async ctx => {
	const project = await Project.findByRepo(ctx.request.body.repository.full_name);

	if(project.active == true) {
		await project.deploy();
	}
});
