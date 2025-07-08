import Database from "@kyvrixon/json-db";
import { mainmenu } from "./int/main-menu.js";
import { homedir } from "os";
import ora from "ora";
import path from "path";
import fs from 'fs';
import { blue, bold, cyan, gray, green, yellow } from "colorette";
import * as y from '@inquirer/prompts';
import Encryptor from "@kyvrixon/encryptor";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const subtitle = gray("Kyvrixon CLI Password Manager - Version 0.0.6");
const separator = gray("─".repeat(50));

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
		"CLI Password Manager",
		"data",
	);
	globalThis.db = new Database(dbPath, { create: true });
	let existingdata = await db.read<UserData>("creds");

	try {
		const localPkgPath = path.join(__dirname, "..", "package.json");
		const localPkg = JSON.parse(await fs.promises.readFile(localPkgPath, "utf8"));
		const localVersion = localPkg.version;

		const res = await fetch("https://raw.githubusercontent.com/Kyvrixon/CLI-Password-Manager/main/package.json");
		if (res.ok) {
			const remotePkg = await res.json();
			const remoteVersion = remotePkg.version;
			if (localVersion !== remoteVersion) {
				console.log(
					"\n" +
					gray("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
				);
				console.log(yellow(`✨  A new version is available!`));
				console.log(gray(`Your version: ${localVersion}`));
				console.log(green(`Latest version: ${remoteVersion}`));
				console.log(`Visit ${cyan("https://github.com/Kyvrixon/CLI-Password-Manager")} to update.`);
				console.log(gray("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"));
			}
		}
	} catch (e) {
		console.log(gray("⚠️  Could not check for latest version. Please check your internet connection."));
	}

	spinner.stop();

	if (!existingdata) {
		const temp: Partial<UserData> = {};

		// Welcome box
		console.log(
			gray("╔" + "═".repeat(48) + "╗")
		);
		console.log(
			gray("║") +
			bold(green("   ✨ Welcome to Enterprise Password Manager! ✨   ")) +
			gray("║")
		);
		console.log(
			gray("╚" + "═".repeat(48) + "╝")
		);

		console.log(separator);
		console.log(bold("Let's set up your secure password vault.\n"));
		await delay(500);

		console.log(
			yellow("⚠️  Never share your mastercode. If forgotten, vault access is lost.")
		);
		console.log(yellow("🔒  All data is encrypted with your mastercode."));
		console.log(separator + "\n");
		await delay(1000);

		console.log(bold(blue("\n👤  Step 1: Enter Your Name")));
		const username = await y.input({
			message: blue("   Enter your name: "),
			validate: async (value: any) => {
				if (/\d/.test(value)) return "Name cannot contain numbers.";
				if (!value.trim()) return "Name cannot be empty.";
				return true;
			},
		});
		temp.name = username;
		console.log(green(`\n✅  Hello, ${username}!\n`));
		await delay(400);

		let mastercode: string = "";
		let confirmed = false;
		do {
			console.log(bold(blue("🔑  Step 2: Set Your Mastercode")));
			console.log("   This code unlocks your vault. Minimum 5 characters.");
			mastercode = await y.input({
				message: "   Enter mastercode: ",
				validate: async (value) => {
					if (value.length < 5)
						return "Mastercode must be at least 5 characters.";
					return true;
				},
			});

			console.log(bold(blue("🔁  Confirm Mastercode")));
			console.log(`   You entered: ${cyan(mastercode)}`);
			const confirm = await y.confirm({
				message: blue("   Is this correct?"),
				default: true,
			});

			confirmed = confirm;
			if (!confirm) {
				console.log(yellow("\nLet's try again.\n"));
				await delay(600);
				console.clear();
				console.log(subtitle);
			}
		} while (!confirmed);

		temp.mastercode = mastercode;

		await db.write("creds", temp);
		existingdata = await db.read<UserData>("creds");

		console.log(
			green("\n🎉  Setup complete! Welcome aboard.\n") +
			gray("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
		);
		console.log(
			bold("Summary:") +
			`\n   Name: ${cyan(temp.name)}` +
			`\n   Mastercode: ${cyan(temp.mastercode.length)}\n`
		);
		await delay(1200);
	}

	globalThis.enc = new Encryptor(existingdata!.mastercode, {
		iterations: 25_000,
	});

	console.clear();
	spinner.start("Loading...");
	await delay(1000);
	spinner.stop();
	mainmenu();
	return;
}

onboarding();
