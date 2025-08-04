import * as y from "@inquirer/prompts";
import fs from "fs";
import { homedir } from "os";
import path from "path";
import { colors, delay, errorHandler, ui, utils } from "../../utils/index.js";

export default async function exportVault(): Promise<void> {
	try {
		ui.header("Export Vault", "Backup your password vault securely");

		spinner.start("Preparing vault data...");

		const passwordData =
			(await db.read<PasswordData>("vault", "passwords")) || [];
		const userData = globalThis.userData;

		if (passwordData.length === 0) {
			spinner.warn("Your vault is empty!");
			ui.space();
			console.log(
				colors.muted("💡 Add some passwords first before creating a backup"),
			);
			await delay(2500);
			return;
		}

		spinner.stop();

		ui.space();
		console.log(colors.primary("📦 Export Options:"));
		ui.space();

		const exportType = await y.select({
			message: colors.primary("Choose export format:"),
			choices: [
				{
					name: "🔒 Encrypted backup (recommended)",
					value: "encrypted",
					description: "Export with password protection",
				},
				{
					name: "📄 Plain text (JSON)",
					value: "json",
					description: "Unencrypted for manual inspection",
				},
				{
					name: "📊 Statistics only",
					value: "stats",
					description: "Export vault statistics without passwords",
				},
			],
		});

		const exportDir = await y.input({
			message: colors.primary("Export directory (or press Enter for desktop):"),
			default: path.join(homedir(), "Desktop"),
			validate: (value) => {
				try {
					if (!fs.existsSync(value)) {
						return "Directory does not exist";
					}
					return true;
				} catch {
					return "Invalid directory path";
				}
			},
		});

		const timestamp = new Date()
			.toISOString()
			.replace(/[:.]/g, "-")
			.split("T")[0];
		const filename = `password-vault-backup-${timestamp}`;

		const mastercode = await y.password({
			message: colors.primary(
				"Enter your master code to export all data (WARNING: this will include all passwords and your mastercode in plain text):",
			),
		});

		if (mastercode !== globalThis.userData.mastercode) {
			ui.space();
			console.log(colors.error("Incorrect master code. Export cancelled."));
			await delay(1500);
			return;
		}

		spinner.start("Creating backup...");

		try {
			let exportData: any;
			let fileExtension: string;
			let fullPath: string;

			exportData = {
				version: "1.0.0",
				exportDate: new Date().toISOString(),
				userData: userData,
				passwords: passwordData,
				mastercode: globalThis.userData.mastercode,
				checksum: utils.generateId(),
			};

			fileExtension = exportType === "encrypted" ? ".kyvault" : ".json";
			fullPath = path.join(exportDir, filename + fileExtension);
			const content =
				exportType === "encrypted"
					? await enc.encrypt(JSON.stringify(exportData))
					: JSON.stringify(exportData, null, 2);
			await fs.promises.writeFile(fullPath, content, "utf8");

			spinner.succeed("Backup created successfully!");

			ui.space();
			console.log(
				colors.warning(
					"⚠️  WARNING: This export could contain ALL your data, including passwords and mastercode! Please keep it safe and do not share it!",
				),
			);
			ui.space();

			if (exportType === "encrypted") {
				console.log(
					colors.primary("🔐 Your backup is encrypted with your master code."),
				);
				console.log(colors.primary("   Use it to restore your vault later."));
			}

			ui.space();
			console.log(colors.success_bold("🎉 Export completed!"));
			ui.divider("─", 40, colors.success);
			console.log(
				`   ${colors.primary("File:")} ${colors.highlight(path.basename(fullPath))}`,
			);
			console.log(
				`   ${colors.primary("Location:")} ${colors.muted(exportDir)}`,
			);
			console.log(`   ${colors.primary("Type:")} ${colors.text(exportType)}`);
			console.log(
				`   ${colors.primary("Passwords:")} ${colors.highlight(passwordData.length.toString())}`,
			);
			ui.divider("─", 40, colors.success);
			ui.space();

			if (exportType === "encrypted") {
				console.log(
					colors.warning("🔐 Important: Keep your backup password safe!"),
				);
				console.log(
					colors.muted("   Without it, the backup cannot be restored."),
				);
				ui.space();
			}

			await y.confirm({
				message: colors.primary("Press Enter to return to the main menu"),
			});
		} catch (error) {
			spinner.fail("Failed to create backup");
			await errorHandler.handle(error as Error, "vault export");
		}
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
			await errorHandler.handle(error as Error, "vault export");
		}
	}
	// Return to main menu will be handled automatically
}
