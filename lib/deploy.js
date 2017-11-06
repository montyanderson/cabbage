const path = require("path");
const fs = require("mz/fs");
const crypto = require("mz/crypto");
const yup = require("yup");
const execa = require("execa");
const Minimatch = require("minimatch").Minimatch;
const rreaddir = require("recursive-readdir");
const Postmark = require("postmark");
const redis = require("./redis");
const Server = require("../lib/Server");
const Log = require("../lib/Log");
const github = require("../.github");
const postmarkConfig = require("../.postmark");

const postmark = new Postmark.Client(postmarkConfig.serverKey);

module.exports = async function deploy({ added = [], removed = [], modified = [] } = {}) {
	const project = this;
	const log = new Log(project.id);

	await log.push(`Deploy for project '${project.name}' at '${project.repo}' started`);

	await log.push("Added files: ", added);
	await log.push("Removed files: ", removed);
	await log.push("Modified files: ", modified);

	try {
		const directory = `/tmp/${(await crypto.randomBytes(32)).toString("hex")}`;

		await log.push(`Creating directory '${directory}'`);
		await fs.mkdir(directory);

		const repoUrl = `https://${github.username}:${github.password}@github.com/${project.repo}`;

		await log.push(`Cloning git repository '${repoUrl}'`);
		const git = await execa("git", [ "clone", repoUrl, directory ]);

		const cabbageFilePath = `${directory}/.cabbage`;
		await log.push(`Attempting to find .cabbage file '${cabbageFilePath}'`);

		try {
			await fs.access(cabbageFilePath);
			await execa(`chmod`, [ "+x", cabbageFilePath ]);

			await execa.shell(`${cabbageFilePath}`, {
				cwd: directory
			});
		} catch(error) {
			// .cabbage file not found
			await log.push(`.cabbage file not found`);
		};

		const cabbageIgnorePath = `${directory}/.cabbageignore`;
		await log.push(`Attempting to find .cabbageignore file '${cabbageIgnorePath}'`);

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

		await log.push(`Loading servers from redis: ${JSON.stringify(project.servers)}`);
		const servers = await Promise.all(project.servers.map(id => Server.find(id)));

		const scp = [];

		// sanitize
		const projectDirectory = project.directory.replace(new RegExp(`"`, "g"), `\\"`);

		let files = [ ...added, ...modified ];
		await log.push(`Files to copy: ${files}\n`);

		if(files.length === 0) {
			await log.push(`Copying ALL files due to none being specified`);
			files = await rreaddir(directory);

			files.map(f =>
				f.slice(directory.slice(-1) == "/" ? directory.length : directory.length + 1)
			);

			await log.push("Files found: ", files);
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

		await log.push("Files filtered and morphed: ", files);

		await Promise.all(servers.map(async (server, i) => {

			let cmd;

			if(removed.length > 0) {
				cmd = `rm -rf ${removed.map(f => `"${projectDirectory}/${f}"`).join(" ")}`

				await log.push(`ssh: ${cmd}`);

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

			await log.push(`ssh: ${cmd}`);

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

			while(files.length > 0) {
				const batch = files.splice(0, 5);

				await Promise.all(batch.map(async file => {
					const local = `${directory}/${file}`;
					const remote = `${projectDirectory}/${path.dirname(file)}`;

					await log.push(`Copying file ${local} to ${server.username}@${server.address}:${remote}`);

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
				}));
			}

			await log.push(`Coppied files to ${server.username}@${server.address}`);

		}));

		await log.push(`Deleting directory ${directory}`);

		await execa("rm", [ "-rf", directory ]);

		await log.succeeded();
	} catch(err) {
		await log.push(err.toString());
		await log.failed();

		for(let address of postmarkConfig.to) {
			postmark.sendEmail({
				"From": postmarkConfig.from,
				"To": address,
				"Subject": `'${project.name}' Deployment Failed!`,
				"TextBody": await log.get()
			});
		}
	}

	return "";
}
