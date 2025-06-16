import Database from "@kyvrixon/json-db";
import path from "path";
import * as y from "@inquirer/prompts";
import ora from "ora";
import Encryptor from "@kyvrixon/encryptor";
import { homedir } from "os";
import fs from "fs";
import { mainmenu } from "./int/main-menu.js";
import { blue, gray, yellow, green, bold, cyan } from "colorette";

const subtitle =
	gray("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n") +
	blue("🔐  Enterprise Password Manager\n") +
	gray("   Security. Simplicity. Trust.\n") +
	"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";

const separator = gray("──────────────────────────────────────────────");


process.stdout.write("\x1b]0;🔐 Password Manager\x07");
console.clear();

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

process.on("uncaughtException", (error) => {
	console.log(error.name);
	if (error instanceof Error && error.name === "ExitPromptError") {
		console.log(gray("👋 Bye bye"));
	} else {
		throw error;
	}
});

process.on("unhandledRejection", (error) => {
	console.log(error);
	if (error instanceof Error && error.name === "ExitPromptError") {
		console.log(gray("👋 Bye bye"));
	} else {
		throw error;
	}
});

process.on("SIGINT", async () => {
	console.log(gray("👋 Bye bye"));
	await delay(500);
	process.exit(0);
});

async function onboarding() {
	console.clear();
	console.log(subtitle);

	globalThis.spinner = ora({
		text: "Initializing...",
		spinner: "point",
	}).start();
	const dbPath = path.join(
		homedir(),
		"Kyvrixon Development",
		"Password Manager",
		"data",
	);
	globalThis.db = new Database(dbPath, { create: true });
	let existingdata = await db.read<UserData>("creds");

	// Version check
	try {
		const localPkgPath = path.join(__dirname, "..", "package.json");
		const localPkg = JSON.parse(await fs.promises.readFile(localPkgPath, "utf8"));
		const localVersion = localPkg.version;

		const res = await fetch("https://raw.githubusercontent.com/Kyvrixon/CLI-Password-Manager/main/package.json");
		if (res.ok) {
			const remotePkg = await res.json();
			const remoteVersion = remotePkg.version;
			if (localVersion !== remoteVersion) {
				console.log(yellow(`\n✨ A new version is available!`));
				console.log(gray(`Your version: ${localVersion}`));
				console.log(green(`Latest version: ${remoteVersion}`));
				console.log(`Visit ${cyan("https://github.com/Kyvrixon/CLI-Password-Manager")} to update.\n`);
			}
		}
	} catch (e) {
		console.log(gray("⚠️ Could not check for latest version. Please check your internet connection."));
	}

	spinner.stop();

	if (!existingdata) {
		const temp: Partial<UserData> = {};

		console.log(bold(green("\n✨ Welcome to Enterprise Password Manager! ✨")));
		console.log(separator);
		console.log("Let's set up your secure password vault.\n");
		await delay(500);

		console.log(
			yellow(
				"⚠️  Never share your mastercode. If forgotten, vault access is lost.",
			),
		);
		console.log(yellow("🔒  All data is encrypted with your mastercode."));
		console.log(separator + "\n");
		await delay(1000);

		// Name input
		console.log(bold(blue("\nStep 1: Enter Your Name")));
		const username = await y.input({
			message: blue("👤  Enter your name: "),
			validate: async (value) => {
				if (/\d/.test(value)) return "Name cannot contain numbers.";
				if (!value.trim()) return "Name cannot be empty.";
				return true;
			},
		});
		temp.name = username;
		console.log(green(`Hello, ${username}!\n`));
		await delay(400);

		// Mastercode input, confirmation loop
		let mastercode: string = "";
		let confirmed = false;
		do {
			console.log(bold(blue("Step 2: Set Your Mastercode")));
			console.log("🔑  This code unlocks your vault. Minimum 5 characters.");
			mastercode = await y.input({
				message: " ",
				validate: async (value) => {
					if (value.length < 5)
						return "Mastercode must be at least 5 characters.";
					return true;
				},
			});

			console.log("🔁  Confirm Mastercode");
			console.log(`You entered: ${cyan(mastercode)}`);
			const confirm = await y.confirm({
				message: blue("Is this correct?"),
				default: true,
			});

			confirmed = confirm;
			if (!confirm) {
				console.log(yellow("Let's try again.\n"));
				await delay(600);
				console.clear();
			}
		} while (!confirmed);

		// ? await fs.promises.writeFile(mastercodeLocation, mastercode, "utf8");
		// ? temp.mastercode = mastercode;

		temp.mastercode = mastercode;

		await db.write("creds", temp);
		existingdata = await db.read<UserData>("creds");

		console.log(green("\n🎉  Setup complete! Welcome aboard.\n"));
		await delay(1200);
	}

	globalThis.enc = new Encryptor(existingdata!.mastercode, {
		iterations: 100_000,
	});

	console.clear();
	spinner.start("Loading...");
	await delay(1000);
	spinner.stop();
	mainmenu();
	return;
}

onboarding();
