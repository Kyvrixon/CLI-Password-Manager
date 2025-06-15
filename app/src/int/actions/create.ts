import { mainmenu } from "../main-menu.js";
import * as y from "@inquirer/prompts";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export default async () => {
	spinner.start("Loading...");

	const existingData =
		(await db.read<PasswordData>("passwords")) || ([] as PasswordData);

	spinner.stop();

	console.log("Enter a nickname for your password:");
	const name = await y.input({
		message: "✨",
		required: true,
		validate: (value) => {
			for (const pwd of existingData) {
				if (pwd.nickname.toLowerCase() === value.toLowerCase()) {
					return "This nickname already exists. Please choose a different one.";
				}
			}
			return true;
		},
	});

	console.log(
		"Good! Now enter your password! This will be encrypted and stored securely.",
	);
	const value = await y.input({
		message: "✨",
		required: true,
	});

	console.log("Finally, add a description for your password!");
	const description = await y.input({
		message: "✨",
		required: true,
	});

	spinner.start("Saving...");

	const encryptedPassword = await enc.encrypt(value);

	existingData.push({
		nickname: name,
		value: encryptedPassword,
		description: description,
	});

	await db.write("passwords", existingData);
	spinner.succeed("Password saved successfully!");
	await delay(2000);
	mainmenu();
	return;
};
