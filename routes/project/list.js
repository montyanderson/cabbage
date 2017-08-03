const _ = require("koa-route");
const Project = require("../../lib/Project");

module.exports = _.get("/project/list", async ctx => {
	ctx.body = await Project.list();
});
