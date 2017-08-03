const fs = require("fs");
const crypto = require("crypto");
const util = require("util");
const _ = require("koa-route");
const execa = require("execa");
const Project = require("../lib/Project");
const Server = require("../lib/Server");

const mkdir = util.promisify(fs.mkdir);
const readdir = util.promisify(fs.readdir);

const secret = fs.readFileSync(__dirname + "/../.push_secret", "utf8").trim();

module.exports = _.post("/push", async ctx => {

	const project = await Project.findByRepo(ctx.request.body.repository.full_name);

	const directory = `/tmp/${crypto.randomBytes(32).toString("hex")}`;
	await mkdir(directory);

	await execa("git", [ "clone", `https://github.com/${project.repo}`, directory ]);

	const serverIds = typeof project.servers == "array" ? project.servers : [ project.servers ];

	const servers = await Promise.all(serverIds.map(id => Server.find(id)));

	await Promise.all(servers.map(async server => {

		const args = [
			"sshpass",
			"-p",
			server.password,
			"-r",
			...((await readdir(directory)).filter(f => f !== ".git").map(f => `${directory}/${f}`)),
			`${server.username}@${server.address}:${project.directory}`
		];

		console.log(await execa("sshpass", args));

	}));

	ctx.body = {};

});
