const fs = require("mz/fs");
const crypto = require("crypto");
const util = require("util");
const _ = require("koa-route");
const execa = require("execa");
const Project = require("../lib/Project");
const Server = require("../lib/Server");

const secret = fs.readFileSync(__dirname + "/../.push_secret", "utf8").trim();

module.exports = _.post("/push", async ctx => {

	const project = await Project.findByRepo(ctx.request.body.repository.full_name);

	if(project.active === false) {
		throw new Error("Deployment not currently active!");
	}

	const directory = `/tmp/${crypto.randomBytes(32).toString("hex")}`;
	await fs.mkdir(directory);

	const git = await execa("git", [ "clone", `https://github.com/${project.repo}`, directory ]);

	const cabbageFilePath = `${directory}/.cabbage`;

	try {
		await fs.access(cabbageFilePath);
		await execa(`chmod`, [ "+x", cabbageFilePath ]);

		await execa.shell(`${cabbageFilePath}`, {
			cwd: directory
		});
	} catch(error) {
		// .cabbage file not found
	};

	const servers = await Promise.all(project.servers.map(id => Server.find(id)));

	const scp = [];

	// sanitize
	const projectDirectory = project.directory.replace(new RegExp(`"`, "g"), `\\"`);

	await Promise.all(servers.map(async (server, i) => {

		await execa("sshpass", [
			"-p",
			server.password,
			"ssh",
			"-p",
			server.port,
			`${server.username}@${server.address}`,
			`rm -rf "${projectDirectory}"/*`
		]);

		await execa("sshpass", [
			"-p",
			server.password,
			"ssh",
			"-p",
			server.port,
			`${server.username}@${server.address}`,
			`mkdir -p "${projectDirectory}"`
		]);

		const files = (await fs.readdir(directory))
			.filter(f => f !== ".git")
			.map(f => `${directory}/${f}`);

		scp[i] = await execa("sshpass", [
			"-p",
			server.password,
			"scp",
			"-P",
			server.port,
			"-r",
			...files,
			`${server.username}@${server.address}:${projectDirectory}`
		]);
	}));

	ctx.body = {
		git: {
			stdout: git.stdout,
			stderr: git.stderr
		},
		scp: scp.map(s => ({
			stdout: s.stdout,
			stderr: s.stderr
		}))
	};
});
