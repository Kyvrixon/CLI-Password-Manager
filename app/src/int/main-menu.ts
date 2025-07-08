import * as y from "@inquirer/prompts";
import fs from "fs";
import path from "path";

// UI helpers
const cyan = (msg: string) => `\x1b[38;5;39m${msg}\x1b[0m`;
const blue = (msg: string) => `\x1b[38;5;33m${msg}\x1b[0m`;
const gray = (msg: string) => `\x1b[38;5;245m${msg}\x1b[0m`;

const printSection = (msg: string) => {
	console.log(`\n${blue("╭" + "─".repeat(2) + " " + msg)}`);
};

const printDivider = () => {
	console.log(gray("├" + "─".repeat(30)));
};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

//TODO: Add edit action
const menuActions = [
	{
		value: "view-all",
		name: "View",
		description: "View all of your saved passwords.",
		file: "./actions/view-all.js",
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
	return path.dirname(
		decodeURIComponent(new URL(importUrl).pathname).replace(
			/^\/([a-zA-Z]:)/,
			"$1",
		),
	);
}

async function getMenuWithStatus(dirname: string) {
	return Promise.all(
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
				description: !exists ? gray("Coming soon") : item.description,
			};
		}),
	);
}

export const mainmenu = async () => {
	console.clear();

	const dirname = getDirname(import.meta.url);
	const menuWithStatus = await getMenuWithStatus(dirname);

	printSection("Main Menu");
	printDivider();

	const action = await y
		.select({
			message: cyan("What would you like to do?"),
			loop: true,
			choices: menuWithStatus.map((item) => ({
				value: item.value,
				name: item.disabled ? gray(item.name) : item.name,
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
