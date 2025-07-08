import * as y from "@inquirer/prompts";
import { mainmenu } from "../main-menu.js";
import * as colors from "colorette";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export default async function deletePassword() {
	spinner.start("Loading...");

	const existingData = (await db.read<PasswordData>("passwords")) || [];

	if (existingData.length === 0) {
		spinner.warn(colors.yellow("No saved passwords to delete!"));
		await delay(2000);
		return mainmenu();
	}

	spinner.stop();

	const choices = (data: PasswordData) =>
		data.map((pwd) => ({
			name: colors.cyan(pwd.nickname),
			value: pwd.value,
			description: pwd.description ? colors.gray(pwd.description) : undefined,
		}));

	const selectedValue = await y.search({
		message: colors.bold("🔑 Choose a password to delete:"),
		source: async (input) => {
			const filtered = input
				? existingData.filter((pwd) =>
					pwd.nickname.toLowerCase().includes(input.toLowerCase()),
				)
				: existingData;
			return choices(filtered);
		},
		pageSize: 5,
		validate: (value) => !!value || colors.red("Please select a password to delete."),
	});

	const chosenIndex = existingData.findIndex(
		(pwd) => pwd.value === selectedValue,
	);
	if (chosenIndex === -1) {
		console.error("Password not found.");
		await delay(1500);
		return mainmenu();
	}

	const confirm = await y.confirm({
		message: colors.yellow(
			`⚠️  Are you sure you want to delete the password for ${colors.bold(
				existingData[chosenIndex].nickname,
			)}?`
		),
		default: false,
	});

	if (!confirm) {
		console.info("Deletion cancelled.");
		await delay(1000);
		return mainmenu();
	}

	existingData.splice(chosenIndex, 1);
	await db.write<PasswordData>("passwords", existingData);

	console.log(colors.green("✅ Password deleted successfully!"));
	await delay(1500);
	mainmenu();
}
