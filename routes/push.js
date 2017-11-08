const _ = require("koa-route");
const crypto = require("crypto");
const fs = require("mz/fs");
const Project = require("../lib/Project");

module.exports = _.post("/push", async ctx => {
	const project = await Project.findByRepo(ctx.request.body.repository.full_name);

	const hmac = crypto.createHmac("sha1", project.pushSecret);
	hmac.update(ctx.request.rawBody);

	if(`sha1=${hmac.digest("hex")}` !== ctx.request.headers["x-hub-signature"]) {
		ctx.response.status = 401;
		return;
	}

	const added = [].concat(...ctx.request.body.commits.map(c => c.added));
	const modified = [].concat(...ctx.request.body.commits.map(c => c.modified));
	const removed = [].concat(...ctx.request.body.commits.map(c => c.removed));

	if(project.active == true) {
		ctx.body = await project.deploy({ added, modified, removed });
		return;
	}

	ctx.body = "Project not active!";
});
