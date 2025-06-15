import * as y from "@inquirer/prompts";
import { mainmenu } from "../main-menu.js";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export default async () => {
	spinner.start("Loading...");

	const existingData = (await db.read<PasswordData>("passwords")) || [];

	if (existingData.length === 0) {
		spinner.warn("Looks like you have no saved passwords to delete!");
		await delay(3000);
		mainmenu();
		return;
	}

	spinner.stop();

	const choices = (data: PasswordData) =>
		data.map((pwd) => ({
			name: pwd.nickname,
			value: pwd.value,
			description: pwd.description,
		}));

	const selectedValue = await y.search({
		message: "Choose a password to delete",
		source: async (input) => {
			const filtered = input
				? existingData.filter((pwd) =>
						pwd.nickname.toLowerCase().includes(input.toLowerCase()),
					)
				: existingData;
			return choices(filtered);
		},
		pageSize: 5,
		validate: (value) => !!value || "Please select a password to delete.",
	});

	const chosenIndex = existingData.findIndex(
		(pwd) => pwd.value === selectedValue,
	);
	if (chosenIndex === -1) {
		console.log("Password not found.");
		await delay(3000);
		mainmenu();
		return;
	}

	const confirm = await y.confirm({
		message: `Are you sure you want to delete the password for ${existingData[chosenIndex].nickname}?`,
	});

	if (!confirm) {
		mainmenu();
		return;
	}

	existingData.splice(chosenIndex, 1);
	await db.write<PasswordData>("passwords", existingData);

	console.log("Password Deleted Successfully!");
	await delay(3000);
	mainmenu();
};
