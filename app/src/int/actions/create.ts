import { mainmenu } from "../main-menu.js";
import * as y from "@inquirer/prompts";
import { cyanBright, yellow, green, red } from "colorette";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export default async function createPassword() {
	try {
		spinner.start("Loading your passwords...");

		const existingData =
			(await db.read<PasswordData>("passwords")) || ([] as PasswordData);

		spinner.stop();

		console.log(cyanBright("\n🔖 Create a new password entry"));

		const name = await y.input({
			message: yellow("Nickname:"),
			required: true,
			validate: (value) => {
				if (!value.trim()) return "Nickname cannot be empty.";
				for (const pwd of existingData) {
					if (pwd.nickname.toLowerCase() === value.toLowerCase()) {
						return "This nickname already exists. Please choose a different one.";
					}
				}
				return true;
			},
		});

		const value = await y.input({
			message: yellow("Password:"),
			validate: (val) => (val.trim() ? true : "Password cannot be empty."),
		});

		const description = await y.input({
			message: yellow("Description:"),
			required: true,
			validate: (val) => (val.trim() ? true : "Description cannot be empty."),
		});

		spinner.start("Encrypting and saving your password...");

		const encryptedPassword = await enc.encrypt(value);

		existingData.push({
			nickname: name,
			value: encryptedPassword,
			description,
		});

		await db.write("passwords", existingData);

		spinner.succeed(green("✅ Password saved successfully!"));
		await delay(1200);
	} catch (err) {
		spinner.fail(red("❌ Failed to save password."));
		console.error(err);
	}
	await mainmenu();
}
