const path = require("path");
const fs = require("mz/fs");
const crypto = require("mz/crypto");
const yup = require("yup");
const execa = require("execa");
const Minimatch = require("minimatch").Minimatch;
const redis = require("./redis");
const Server = require("../lib/Server");
const github = require("../.github");

module.exports = async function deploy({ added = [], removed = [], modified = [] } = {}) {
	const logField = "log";

	const project = this;

	await redis.append(logField, `Deploy for project '${project.name}' at '${project.repo}' started\n`);

	await redis.append(logField, `Added files: ${added}`);
	await redis.append(logField, `Removed files: ${removed}`);
	await redis.append(logField, `Modified files: ${modified}`);

	const directory = `/tmp/${(await crypto.randomBytes(32)).toString("hex")}`;

	await redis.append(logField, `Creating directory '${directory}'`);
	await fs.mkdir(directory);

	const repoUrl = `https://${github.username}:${github.password}@github.com/${project.repo}`;


	await redis.append(logField, `Cloning git repository '${repoUrl}'`);
	const git = await execa("git", [ "clone", repoUrl, directory ]);

	const cabbageFilePath = `${directory}/.cabbage`;
	await redis.append(logField, `Attempting to find .cabbage file '${cabbageFilePath}'`);

	try {
		await fs.access(cabbageFilePath);
		await execa(`chmod`, [ "+x", cabbageFilePath ]);

		await execa.shell(`${cabbageFilePath}`, {
			cwd: directory
		});
	} catch(error) {
		// .cabbage file not found
		await redis.append(logField, `.cabbage file not found`);
	};

	const cabbageIgnorePath = `${directory}/.cabbageignore`;
	await redis.append(logField, `Attempting to find .cabbageignore file '${cabbageIgnorePath}'`);

	let ignore = [];

	try {
		ignore = (await fs.readFile(cabbageIgnorePath, "utf8"))
			.split("\n")
			.filter(a => !!a)
			.map(a => new Minimatch(a));
	} catch(error) {
		// console.log(error);
		// .cabbageignore file not found
	}

	await redis.append(logField, `Loading servers from redis: ${JSON.stringify(project.servers)}`);
	const servers = await Promise.all(project.servers.map(id => Server.find(id)));

	const scp = [];

	// sanitize
	const projectDirectory = project.directory.replace(new RegExp(`"`, "g"), `\\"`);

	let files = [ ...added, ...modified ];
	await redis.append(logField, `Files to copy: ${files}`);

	if(files.length === 0) {
		await redis.append(logFile, `Copying ALL files due to none being specified`);
		files = await fs.readdir(directory);
		await redis.append(logFile, `Files found: ${files}`);
	}

	files = files
		.filter(f => f !== ".git" && f !== ".cabbage" && f !== ".cabbageignore")
		.filter(f => {
			for(let m of ignore) {
				if(m.match(f) === true) {
					return false;
				}
			}

			return true;
		});

	await redis.append(logFile, `Files filtered and morphed: ${files}`);

	await Promise.all(servers.map(async (server, i) => {

		let cmd;

		if(removed.length > 0) {
			cmd = `rm -rf ${removed.map(f => `"${projectDirectory}/${f}"`).join(" ")}`

			await redis.append(logFile, `ssh: ${cmd}`);

			await execa("sshpass", [
				"-e",
				"ssh",
				"-o",
				"UserKnownHostsFile=/dev/null",
				"-o",
				"StrictHostKeyChecking=no",
				"-p",
				server.port,
				`${server.username}@${server.address}`,
				cmd
			], {
				env: {
					SSHPASS: server.password
				}
			});
		}

		cmd = `mkdir -p "${projectDirectory}"`;

		await redis.append(logFile, `ssh: ${cmd}`);

		await execa("sshpass", [
			"-e",
			"ssh",
			"-o",
			"UserKnownHostsFile=/dev/null",
			"-o",
			"StrictHostKeyChecking=no",
			"-p",
			server.port,
			`${server.username}@${server.address}`,
			cmd
		], {
			env: {
				SSHPASS: server.password
			}
		});

		for(let file of files) {
			const local = `${directory}/${file}`;
			const remote = `${projectDirectory}/${path.dirname(file)}`;

			await redis.append(logFile, `Copying file ${local} to ${server.username}@${server.address}:${remote}`);

			await execa("sshpass", [
				"-e",
				"scp",
				"-o",
				"UserKnownHostsFile=/dev/null",
				"-o",
				"StrictHostKeyChecking=no",
				"-P",
				server.port,
				"-r",
				local,
				`${server.username}@${server.address}:${remote}`
			], {
				env: {
					SSHPASS: server.password
				}
			});
		}

		await redis.append(logFile, `Coppied files to ${server.username}@${server.address}`);

	}));

	await redis.append(logFile, `Deleting directory ${directory}`);

	await execa("rm", [ "-rf", directory ]);

	return `Deployment of files ${files.map(f => f.split("/").pop()).join(", ")} to servers ${servers.map(s => JSON.stringify(s.name)).join(", ")} complete.`;
}
