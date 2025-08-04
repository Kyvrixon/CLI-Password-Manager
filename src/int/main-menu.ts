import * as y from "@inquirer/prompts";
import fs from "fs";
import path from "path";
import { colors, ui, utils, delay, errorHandler } from "../utils/index.js";

// Static imports for all action modules
import viewAllAction from "./actions/view-all.js";
import createAction from "./actions/create.js";
import editAction from "./actions/edit.js";
import deleteAction from "./actions/delete.js";
import generateAction from "./actions/generate.js";
import exportAction from "./actions/export.js";
import importAction from "./actions/import.js";
import statsAction from "./actions/stats.js";
import settingsAction from "./actions/settings.js";
import changeMasterAction from "./actions/change-master.js";

// Action function mapping
const actionFunctions: Record<string, () => Promise<void>> = {
	"view-all": viewAllAction,
	create: createAction,
	edit: editAction,
	delete: deleteAction,
	generate: generateAction,
	export: exportAction,
	import: importAction,
	stats: statsAction,
	settings: settingsAction,
	"change-master": changeMasterAction,
};

const menuActions = [
	{
		value: "view-all",
		name: "🔍 View Passwords",
		description: "Search and view your saved passwords",
		file: "./actions/view-all.ts",
		category: "main",
	},
	{
		value: "create",
		name: "➕ Add Password",
		description: "Create a new password entry",
		file: "./actions/create.ts",
		category: "main",
	},
	{
		value: "edit",
		name: "✏️  Edit Password",
		description: "Modify an existing password",
		file: "./actions/edit.ts",
		category: "main",
	},
	{
		value: "delete",
		name: "🗑️  Delete Password",
		description: "Remove a password from vault",
		file: "./actions/delete.ts",
		category: "main",
	},
	{
		value: "generate",
		name: "🎲 Generate Password",
		description: "Create a strong random password",
		file: "./actions/generate.ts",
		category: "tools",
	},
	{
		value: "export",
		name: "💾 Export Vault",
		description: "Backup your password vault",
		file: "./actions/export.ts",
		category: "tools",
	},
	{
		value: "import",
		name: "📥 Import Vault",
		description: "Restore from backup file",
		file: "./actions/import.ts",
		category: "tools",
	},
	{
		value: "stats",
		name: "📊 Vault Statistics",
		description: "View vault analytics and health",
		file: "./actions/stats.ts",
		category: "tools",
	},
	{
		value: "settings",
		name: "⚙️  Settings",
		description: "Configure application preferences",
		file: "./actions/settings.ts",
		category: "system",
	},
	{
		value: "change-master",
		name: "🔐 Change Master Code",
		description: "Update your master code",
		file: "./actions/change-master.ts",
		category: "system",
	},
	{
		value: "exit",
		name: "👋 Exit",
		description: "Close the application",
		file: null,
		category: "system",
	},
];

async function getMenuWithStatus() {
	return menuActions.map((item) => {
		const f = ["import", "export", "change-master", "settings"].includes(
			item.value,
		);

		return {
			...item,
			disabled: f,
			description: f ? colors.muted("Coming soon...") : item.description,
		};
	});
}

async function showVaultSummary() {
	try {
		const passwords = (await db.read<PasswordData>("vault", "passwords")) || [];
		const stats = utils.calculateVaultStats(passwords);

		ui.space();
		console.log(colors.brand("📋 Vault Overview"));
		ui.divider("─", 25, colors.muted);
		console.log(
			`   ${colors.primary("Passwords:")} ${colors.highlight(stats.totalPasswords.toString())}`,
		);
		console.log(
			`   ${colors.primary("Categories:")} ${colors.highlight(stats.categories.length.toString())}`,
		);
		console.log(
			`   ${colors.primary("Last backup:")} ${colors.muted(stats.lastBackup || "Never")}`,
		);
		ui.space();
	} catch (error) {
		// Silently fail - vault summary is not critical
	}
}

export const mainmenu = async (): Promise<void> => {
	try {
		console.clear();

		ui.header(
			"Password Manager",
			`Welcome back, ${globalThis.userData?.name || "User"}!`,
		);

		console.log(
			colors.warning(
				"💡 If inputs seem frozen or unresponsive, try pressing Enter again to refresh the input.",
			),
		);
		console.log(colors.warning("   I am working on fixing this issue!"));

		await showVaultSummary();

		const menuWithStatus = await getMenuWithStatus();

		if (process.stdin.readable && process.stdin.readableLength > 0) {
			process.stdin.read();
		}

		await delay(100);
		const mainActions = menuWithStatus.filter(
			(item) => item.category === "main",
		);
		const toolActions = menuWithStatus.filter(
			(item) => item.category === "tools",
		);
		const systemActions = menuWithStatus.filter(
			(item) => item.category === "system",
		);

		const choices = [
			...mainActions.map((item) => ({
				value: item.value,
				name: item.disabled ? colors.muted(item.name) : item.name,
				description: item.description,
				disabled: item.disabled,
			})),
			{
				name: colors.muted("─".repeat(30)),
				value: "separator1",
				disabled: true,
			},
			...toolActions.map((item) => ({
				value: item.value,
				name: item.disabled ? colors.muted(item.name) : item.name,
				description: item.description,
				disabled: item.disabled,
			})),
			{
				name: colors.muted("─".repeat(30)),
				value: "separator2",
				disabled: true,
			},
			...systemActions.map((item) => ({
				value: item.value,
				name: item.disabled ? colors.muted(item.name) : item.name,
				description: item.description,
				disabled: item.disabled,
			})),
		];

		const action = await y
			.select({
				message: colors.primary("What would you like to do?"),
				choices,
				pageSize: 15,
				loop: true,
			})
			.catch(async (error) => {
				if (error.message.includes("User forced exit")) {
					console.log(colors.muted("\n👋 Goodbye! Stay secure."));
					process.exit(0);
				}
				throw error;
			});

		if (action === "exit") {
			console.log(
				colors.success("\n✨ Thank you for using Kyvrixon Password Manager!"),
			);
			console.log(colors.muted("Stay secure! 🔐"));
			process.exit(0);
		}

		if (action.startsWith("separator")) {
			console.clear();
			await delay(100);
			return mainmenu();
		}

		const chosen = menuWithStatus.find((x) => x.value === action);
		if (!chosen || chosen.disabled) {
			ui.status.warning("This feature is not yet available");
			await delay(1500);
			return mainmenu();
		}

		if (!chosen.file) {
			return mainmenu();
		}

		try {
			const actionFn = actionFunctions[chosen.value];
			if (!actionFn) {
				throw new Error(`Action function not found for: ${chosen.value}`);
			}

			await actionFn();

			console.clear();
			await delay(500);
			return mainmenu();
		} catch (error) {
			await errorHandler.handle(error as Error, `loading ${chosen.name}`);
			console.clear();
			await delay(500);
			return mainmenu();
		}
	} catch (error) {
		await errorHandler.handle(error as Error, "main menu");
		await delay(2000);
		await mainmenu();
	}
};
