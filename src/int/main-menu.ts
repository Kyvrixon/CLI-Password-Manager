import * as y from "@inquirer/prompts";
import fs from "fs";
import path from "path";
import { colors, ui, utils, delay, errorHandler } from "../utils/index.js";

// Enhanced menu actions with better organization
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
			if (!item.file) {
				return {
					...item, exists: true, disabled: false
				};
			}

			const filePath = path.resolve(dirname, item.file);
			let exists = false;
			try {
				await fs.promises.access(filePath, fs.constants.F_OK);
				exists = true;
			} catch {
				exists = false;
			}

			const f = [
				"import",
				"export",
				"change-master",
				"settings"
			].includes(item.value);

			return {
				...item,
				exists,
				disabled: f,
				description: f ? colors.muted("Coming soon...") : item.description,
			};
		}),
	);
}

async function showVaultSummary() {
	try {
		const passwords = await db.read<PasswordData>("vault", "passwords") || [];
		const stats = utils.calculateVaultStats(passwords);

		ui.space();
		console.log(colors.brand("📋 Vault Overview"));
		ui.divider("─", 25, colors.muted);
		console.log(`   ${colors.primary("Passwords:")} ${colors.highlight(stats.totalPasswords.toString())}`);
		console.log(`   ${colors.primary("Categories:")} ${colors.highlight(stats.categories.length.toString())}`);
		console.log(`   ${colors.primary("Last backup:")} ${colors.muted(stats.lastBackup || "Never")}`);
		ui.space();
	} catch (error) {
		// Silently fail - vault summary is not critical
	}
}

export const mainmenu = async (): Promise<void> => {
	try {
		console.clear();

		// Header with user info
		ui.header("Password Manager", `Welcome back, ${globalThis.userData?.name || "User"}!`);

		console.log(colors.warning("💡 If inputs seem frozen or unresponsive, try pressing Enter again to refresh the input."));
		console.log(colors.warning("   I am working on fixing this issue!"));

		// Show vault summary
		await showVaultSummary();

		const dirname = getDirname(import.meta.url);
		const menuWithStatus = await getMenuWithStatus(dirname);

		// Clear any residual input buffer to prevent double-enter issues
		if (process.stdin.readable && process.stdin.readableLength > 0) {
			process.stdin.read();
		}

		// Small delay to ensure input system is stable
		await delay(100);

		// Group menu items by category
		const mainActions = menuWithStatus.filter(item => item.category === "main");
		const toolActions = menuWithStatus.filter(item => item.category === "tools");
		const systemActions = menuWithStatus.filter(item => item.category === "system");

		// Create choices with separators
		const choices = [
			...mainActions.map(item => ({
				value: item.value,
				name: item.disabled ? colors.muted(item.name) : item.name,
				description: item.description,
				disabled: item.disabled,
			})),
			{ name: colors.muted("─".repeat(30)), value: "separator1", disabled: true },
			...toolActions.map(item => ({
				value: item.value,
				name: item.disabled ? colors.muted(item.name) : item.name,
				description: item.description,
				disabled: item.disabled,
			})),
			{ name: colors.muted("─".repeat(30)), value: "separator2", disabled: true },
			...systemActions.map(item => ({
				value: item.value,
				name: item.disabled ? colors.muted(item.name) : item.name,
				description: item.description,
				disabled: item.disabled,
			})),
		];

		const action = await y.select({
			message: colors.primary("What would you like to do?"),
			choices,
			pageSize: 15,
			loop: true,
		}).catch(async (error) => {
			if (error.message.includes("User forced exit")) {
				console.log(colors.muted("\n👋 Goodbye! Stay secure."));
				process.exit(0);
			}
			throw error;
		});

		// Handle exit action
		if (action === "exit") {
			console.log(colors.success("\n✨ Thank you for using Kyvrixon Password Manager!"));
			console.log(colors.muted("Stay secure! 🔐"));
			process.exit(0);
		}

		// Skip separators - just refresh the menu
		if (action.startsWith("separator")) {
			console.clear();
			await delay(100);
			return mainmenu();
		}

		// Find and execute the chosen action
		const chosen = menuWithStatus.find((x) => x.value === action);
		if (!chosen || chosen.disabled) {
			ui.status.warning("This feature is not yet available");
			await delay(1500);
			return mainmenu();
		}

		if (!chosen.file) {
			return mainmenu();
		}

		// Load and execute the action module
		const filePath = path.resolve(dirname, chosen.file);
		try {
			// Import the TypeScript file directly since we're using Bun
			const { default: actionFn } = await import("file://" + filePath);
			await actionFn();

			// Always refresh the entire menu after any action completes
			// This prevents input corruption and ensures clean state
			console.clear();
			await delay(500); // Small delay to ensure cleanup
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
