import { mainmenu } from "../main-menu.js";
import * as y from "@inquirer/prompts";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export default async () => {
	try {
		spinner.start("Loading your passwords...");

		const passwordData = await db.read<PasswordData>("passwords");

		if (passwordData === null || passwordData.length === 0) {
			spinner.warn("Looks like you have no saved passwords!");
			await delay(3000);
			mainmenu();
			return;
		}

		spinner.stop();

		const answer = await y.search({
			message: "Choose a password to view",
			source: async (input, { signal }) => {
				if (!input)
					return passwordData.map((pwd) => ({
						name: pwd.nickname,
						value: pwd.value,
						description: pwd.description,
					}));

				const filteredData = passwordData.filter((password) =>
					password.nickname.toLowerCase().includes(input.toLowerCase()),
				);

				if (!filteredData) {
					return [];
				}

				return filteredData.map((pwd) => ({
					name: pwd.nickname,
					value: pwd.value,
					description: pwd.description,
				}));
			},
			pageSize: 5,
		});
		const credData = (await db.read<UserData>("creds")) as UserData;

		await y.input({
			message: "Enter the code to view the password:",
			required: true,
			validate: (value) => {
				if (value !== credData.mastercode) {
					return "Incorrect code.";
				}
				return true;
			},
		});

		const pass = passwordData.find((pwd) => pwd.value === answer)!;

		spinner.start("Decrypting password...");
		const decryptedPassword = await enc
			.decrypt(pass.value)
			.catch(async (err) => {
				spinner.fail("bad things happened...");
				console.error("Error decrypting password:", err);
				await delay(5000);
			});

		spinner.succeed("Password decrypted successfully!");

		await delay(2000);

		console.log(" ");
		console.log("──────────────────────────────────────────────");
		console.log(`🔑  Name        | ${pass.nickname}`);
		console.log(`📝  Description | ${pass.description}`);
		console.log(`🔒  Password    | ${decryptedPassword}`);
		console.log("──────────────────────────────────────────────");

		await y.confirm({
			message: "Press any button when you are done.",
			theme: {
				style: {
					help: () => "",
				},
			},
		});

		mainmenu();
		return;
	} catch (error) {
		console.error("Error:", error);
		await delay(10000);
		mainmenu();
		return;
	}
};
