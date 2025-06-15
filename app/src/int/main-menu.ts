import * as y from "@inquirer/prompts";
import fs from "fs";
import path from "path";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// UI helpers
const printSection = (msg: string) => {
	console.log("\n\x1b[38;5;33m%s\x1b[0m", `╭─ ${msg} `);
};

const menuActions = [
	{
		value: "view-all",
		name: "View all",
		description: "View all of your saved passwords.",
		file: "./actions/view-all.js",
	},
	{
		value: "view-one",
		name: "View one",
		description: "View a password.",
		file: "./actions/view-one.js",
	},
	{
		value: "create",
		name: "Create new",
		description: "Add a new password.",
		file: "./actions/create.js",
	},
	{
		value: "delete",
		name: "Delete",
		description: "Delete a password.",
		file: "./actions/delete.js",
	},
];

function getDirname(importUrl: string) {
	// Handles both Windows and Unix paths
	return path.dirname(
		decodeURIComponent(new URL(importUrl).pathname).replace(
			/^\/([a-zA-Z]:)/,
			"$1",
		),
	);
}

export const mainmenu = async () => {
	console.clear();

	const dirname = getDirname(import.meta.url);

	const menuWithStatus = await Promise.all(
		menuActions.map(async (item) => {
			const filePath = path.resolve(dirname, item.file);
			let exists = false;
			try {
				await fs.promises.access(filePath, fs.constants.F_OK);
				exists = true;
			} catch {
				exists = false;
			}
			return {
				...item,
				disabled: !exists,
				description: !exists ? "Coming soon" : item.description,
			};
		}),
	);

	spinner.stop();

	printSection("Main Menu");

	const action = await y
		.select({
			message: "\x1b[38;5;39mWhat would you like to do?\x1b[0m",
			loop: true,
			choices: menuWithStatus.map((item) => ({
				value: item.value,
				name: `${item.name}`,
				description: item.description,
				disabled: item.disabled,
			})),
		})
		.catch(async (e) => {
			console.log(e);
			await delay(1000);
		});

	const chosen = menuWithStatus.find((x) => x.value === action);
	if (!chosen || chosen.disabled) return;

	const filePath = path.resolve(dirname, chosen.file);
	const { default: fn } = await import("file://" + filePath);
	await fn();
};
