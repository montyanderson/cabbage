const _ = require("koa-route");
const crypto = require("crypto");
const fs = require("mz/fs");
const Project = require("../lib/Project");

const secret = fs.readFileSync(__dirname + "/../.push_secret", "utf8").trim();

module.exports = _.post("/push", async ctx => {
	const hmac = crypto.createHmac("sha1", secret);
	hmac.update(ctx.request.rawBody);

	if(`sha1=${hmac.digest("hex")}` !== ctx.request.headers["x-hub-signature"]) {
		ctx.response.status = 401;

		return;
	}

	const project = await Project.findByRepo(ctx.request.body.repository.full_name);

	if(project.active == true) {
		ctx.body = await project.deploy();
	}
});
