import * as y from "@inquirer/prompts";
import { colors, delay, errorHandler, ui } from "../../utils/index.js";
import fs from "fs";
import path from "path";
import os from "os";

export default async function settings(): Promise<void> {
	try {
		ui.header("Settings", "Customize your password manager");

		const currentSettings = globalThis.userData?.settings || {
			theme: "default",
			confirmDeletions: true,
			showPasswordStrength: true,
		};

		ui.space();
		console.log(colors.primary("⚙️  Current Settings:"));
		ui.space();
		console.log(
			`   ${colors.primary("Theme:")} ${colors.highlight(currentSettings.theme)}`,
		);
		console.log(
			`   ${colors.primary("Confirm deletions:")} ${currentSettings.confirmDeletions ? colors.success("Enabled") : colors.error("Disabled")}`,
		);
		console.log(
			`   ${colors.primary("Show password strength:")} ${currentSettings.showPasswordStrength ? colors.success("Enabled") : colors.error("Disabled")}`,
		);
		ui.space();

		console.log(colors.success("✅ Settings viewed successfully!"));
		console.log(
			colors.muted(
				"💡 To modify settings, access them individually from the main menu",
			),
		);
		ui.space();

		try {
			await y.confirm({
				message: colors.primary("Press Enter to return to main menu"),
				default: true,
			});
		} catch (confirmError) {
			console.log(colors.muted("👋 Returning to main menu..."));
			await delay(500);
		}

		return;
	} catch (error) {
		if (
			error &&
			typeof error === "object" &&
			"message" in error &&
			typeof error.message === "string" &&
			error.message.includes("User forced exit")
		) {
			console.log(colors.muted("\n👋 Returning to main menu..."));
			await delay(500);
		} else {
			await errorHandler.handle(error as Error, "settings");
		}
	}
	// Return to main menu will be handled automatically
}

async function configureTheme(settings: UserSettings): Promise<void> {
	const themes = [
		{
			name: "🎯 Default",
			value: "default",
			description: "Balanced colors and good readability",
		},
		{
			name: "⚡ Minimal",
			value: "minimal",
			description: "Simple and clean appearance",
		},
		{
			name: "🌈 Colorful",
			value: "colorful",
			description: "Rich colors and vibrant interface",
		},
	];

	ui.space();
	console.log(colors.primary("🎨 Theme Preview:"));
	ui.space();

	for (const theme of themes) {
		const isActive = settings.theme === theme.value;
		const prefix = isActive ? "→" : " ";
		console.log(
			`${prefix} ${theme.name} ${isActive ? colors.success("(current)") : ""}`,
		);
		console.log(`   ${colors.muted(theme.description)}`);
		ui.space();
	}

	const newTheme = await y.select({
		message: colors.primary("Choose a theme:"),
		choices: themes,
	});

	settings.theme = newTheme as "default" | "minimal" | "colorful";
	await saveSettings(settings);

	console.log(colors.success(`✅ Theme changed to ${newTheme}`));
	await delay(1500);
}

async function viewDetailedSettings(settings: UserSettings): Promise<void> {
	ui.space();
	console.log(colors.success("📋 Detailed Settings Information"));
	ui.divider("═", 50, colors.primary);

	console.log(
		`${colors.primary("Theme:")} ${colors.highlight(settings.theme)}`,
	);
	console.log(
		`   ${colors.muted("Controls the visual appearance of the interface")}`,
	);
	ui.space();

	console.log(
		`${colors.primary("Deletion Confirmation:")} ${settings.confirmDeletions ? colors.success("Enabled") : colors.error("Disabled")}`,
	);
	console.log(
		`   ${colors.muted("When enabled, prompts for confirmation before deleting passwords")}`,
	);
	ui.space();

	console.log(
		`${colors.primary("Password Strength Display:")} ${settings.showPasswordStrength ? colors.success("Enabled") : colors.error("Disabled")}`,
	);
	console.log(
		`   ${colors.muted("Shows strength indicators and security recommendations")}`,
	);
	ui.space();

	ui.divider("═", 50, colors.primary);

	await y.confirm({
		message: colors.primary("Press Enter to continue"),
		default: true,
	});
}

async function saveSettings(settings: UserSettings): Promise<void> {
	try {
		spinner.start("Saving settings...");

		if (globalThis.userData) {
			globalThis.userData.settings = settings;
			await db.write("vault", "user", globalThis.userData);
		}

		spinner.succeed("Settings saved successfully!");
		await delay(1000);
	} catch (error) {
		spinner.fail("Failed to save settings");
		await errorHandler.handle(error as Error, "save settings");
	}
}

async function exportSettings(settings: UserSettings): Promise<void> {
	try {
		const exportPath = path.join(
			os.homedir(),
			"Desktop",
			"password-manager-settings.json",
		);

		const exportData = {
			version: "1.0.0",
			exportDate: new Date().toISOString(),
			settings: settings,
		};

		spinner.start("Exporting settings...");
		await fs.promises.writeFile(
			exportPath,
			JSON.stringify(exportData, null, 2),
			"utf8",
		);
		spinner.succeed("Settings exported successfully!");

		ui.space();
		console.log(colors.success("📁 Settings exported to:"));
		console.log(colors.highlight(`   ${exportPath}`));
		ui.space();

		await delay(2500);
	} catch (error) {
		spinner.fail("Failed to export settings");
		await errorHandler.handle(error as Error, "export settings");
	}
}

async function importSettings(): Promise<UserSettings | null> {
	try {
		const fs = await import("fs");

		const filePath = await y.input({
			message: colors.primary("Enter path to settings file:"),
			validate: (value) => {
				if (!value.trim()) return "Please enter a file path";
				if (!fs.existsSync(value)) return "File does not exist";
				return true;
			},
		});

		spinner.start("Importing settings...");

		const fileContent = await fs.promises.readFile(filePath, "utf8");
		const importData = JSON.parse(fileContent);

		if (!importData.settings) {
			throw new Error("Invalid settings file format");
		}

		spinner.succeed("Settings imported successfully!");

		console.log(colors.success("✅ Settings imported from file"));
		await delay(1500);

		return importData.settings;
	} catch (error) {
		spinner.fail("Failed to import settings");
		await errorHandler.handle(error as Error, "import settings");
		return null;
	}
}
