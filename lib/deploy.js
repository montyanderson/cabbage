const path = require("path");
const fs = require("mz/fs");
const crypto = require("mz/crypto");
const yup = require("yup");
const execa = require("execa");
const Minimatch = require("minimatch").Minimatch;
const redis = require("./redis");
const Server = require("../lib/Server");
const github = require("../.github");

module.exports = async deploy({ added = [], removed = [], modified = [] } = {}) {
	const project = this;
	console.log(`Deploy for project '${project.name}' at '${project.repo}' started`);

	console.log("Added files:", added);
	console.log("Removed files:", removed);
	console.log("Modified files:", modified);

	const directory = `/tmp/${(await crypto.randomBytes(32)).toString("hex")}`;

	console.log(`Creating directory '${directory}'`);
	await fs.mkdir(directory);

	const repoUrl = `https://${github.username}:${github.password}@github.com/${project.repo}`;

	console.log(`Cloning git repository '${repoUrl}'`);
	const git = await execa("git", [ "clone", repoUrl, directory ]);

	const cabbageFilePath = `${directory}/.cabbage`;
	console.log(`Attempting to find .cabbage file '${cabbageFilePath}'`);

	try {
		await fs.access(cabbageFilePath);
		await execa(`chmod`, [ "+x", cabbageFilePath ]);

		await execa.shell(`${cabbageFilePath}`, {
			cwd: directory
		});
	} catch(error) {
		// .cabbage file not found
		console.log(`.cabbage file not found`);
	};

	const cabbageIgnorePath = `${directory}/.cabbageignore`;
	console.log(`Attempting to find .cabbageignore file '${cabbageIgnorePath}'`);

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

	console.log(`Loading servers from redis:`, project.servers);
	const servers = await Promise.all(project.servers.map(id => Server.find(id)));

	const scp = [];

	// sanitize
	const projectDirectory = project.directory.replace(new RegExp(`"`, "g"), `\\"`);

	let files = [ ...added, ...modified ];
	console.log(`Files to copy:`, files);

	if(files.length === 0) {
		console.log(`Copying ALL files due to none being specified`);
		files = await fs.readdir(directory);
		console.log(`Files found:`, files);
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

	console.log(`Files filtered and morphed:`, files);

	await Promise.all(servers.map(async (server, i) => {

		let cmd;

		if(removed.length > 0) {
			cmd = `rm -rf ${removed.map(f => `"${projectDirectory}/${f}"`).join(" ")}`

			console.log(`ssh: ${cmd}`);

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

		console.log(`ssh: ${cmd}`);

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

			console.log(`Copying file ${local} to ${server.username}@${server.address}:${remote}`);

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

		console.log(`Coppied files to ${server.username}@${server.address}`);

	}));

	console.log(`Deleting directory ${directory}`);

	await execa("rm", [ "-rf", directory ]);

	return `Deployment of files ${files.map(f => f.split("/").pop()).join(", ")} to servers ${servers.map(s => JSON.stringify(s.name)).join(", ")} complete.`;
}
