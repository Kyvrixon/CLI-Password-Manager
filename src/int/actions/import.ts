import * as y from "@inquirer/prompts";
import Encryptor from "@kyvrixon/encryptor";
import fs from "fs";
import { homedir } from "os";
import path from "path";
import { colors, delay, errorHandler, ui, utils } from "../../utils/index.js";

export default async function importVault(): Promise<void> {
	try {
		ui.header("Import Vault", "Restore passwords from a backup");

		const existingPasswords =
			(await db.read<PasswordData>("vault", "passwords")) || [];

		if (existingPasswords.length > 0) {
			ui.space();
			console.log(
				colors.warning("⚠️  You have existing passwords in your vault"),
			);
			console.log(
				colors.muted(
					`   Current vault contains ${existingPasswords.length} password(s)`,
				),
			);
			ui.space();

			const proceed = await y.confirm({
				message: colors.primary(
					"Import will merge with existing data. Continue?",
				),
				default: false,
			});

			if (!proceed) {
				console.log(colors.muted("👋 Import cancelled"));
				await delay(1500);
				return;
			}
		}

		ui.space();
		console.log(colors.primary("📥 Import Options:"));
		ui.space();

		const importType = await y.select({
			message: colors.primary("Choose import source:"),
			choices: [
				{
					name: "🔒 Encrypted backup (.kyvault)",
					value: "encrypted",
					description: "Import from encrypted backup file",
				},
				{
					name: "📄 JSON file",
					value: "json",
					description: "Import from JSON backup",
				},
				{
					name: "📁 Browse for file",
					value: "browse",
					description: "Select backup file manually",
				},
			],
		});

		let filePath: string;

		if (importType === "browse") {
			filePath = await y.input({
				message: colors.primary("Enter full path to backup file:"),
				validate: (value) => {
					if (!value.trim()) return "Please enter a file path";
					if (!fs.existsSync(value)) return "File does not exist";
					return true;
				},
			});
		} else {
			const commonPaths = [
				path.join(homedir(), "Desktop"),
				path.join(homedir(), "Downloads"),
				path.join(homedir(), "Documents"),
			];

			const searchDir = await y.select({
				message: colors.primary("Search directory:"),
				choices: [
					...commonPaths.map((p) => ({
						name: `📁 ${path.basename(p)} (${p})`,
						value: p,
					})),
					{
						name: "🔍 Custom path",
						value: "custom",
					},
				],
			});

			let searchPath: string;
			if (searchDir === "custom") {
				searchPath = await y.input({
					message: colors.primary("Enter directory path:"),
					validate: (value) => {
						if (!fs.existsSync(value)) return "Directory does not exist";
						return true;
					},
				});
			} else {
				searchPath = searchDir;
			}

			spinner.start("Searching for backup files...");

			try {
				const files = await fs.promises.readdir(searchPath);
				const backupFiles = files.filter((file) => {
					const ext = path.extname(file).toLowerCase();
					return ext === ".kyvault" || ext === ".json";
				});

				spinner.stop();

				if (backupFiles.length === 0) {
					console.log(
						colors.warning("⚠️  No backup files found in this directory"),
					);
					ui.space();
					console.log(
						colors.muted("💡 Look for files with .kyvault or .json extensions"),
					);
					await delay(2500);
					return;
				}

				const selectedFile = await y.select({
					message: colors.primary("Select backup file:"),
					choices: backupFiles.map((file) => {
						const fullPath = path.join(searchPath, file);
						const stats = fs.statSync(fullPath);
						const size = (stats.size / 1024).toFixed(1);
						const modified = stats.mtime.toLocaleDateString();

						return {
							name: `${file} (${size}KB, ${modified})`,
							value: fullPath,
						};
					}),
				});

				filePath = selectedFile;
			} catch (error) {
				spinner.fail("Failed to search directory");
				throw error;
			}
		}

		try {
			const fileContent = await fs.promises.readFile(filePath, "utf8");

			let importData: any;

			const mastercode = await y.password({
				message: colors.primary("Enter the master code from the backup file:"),
			});

			try {
				if (filePath.endsWith(".kyvault")) {
					spinner.start("Decrypting backup file...");
					const _enc = new Encryptor(mastercode);
					const decryptedContent = await _enc
						.decrypt(fileContent)
						.catch((err: Error) => {
							spinner.fail("Failed to decrypt backup file");
							console.log(
								colors.error(
									"❌ Invalid master code or encrypted file is corrupted",
								),
							);
							throw err;
						});
					importData = JSON.parse(decryptedContent);
				} else {
					spinner.start("Parsing JSON backup file...");
					importData = JSON.parse(fileContent);
				}
			} catch (error) {
				spinner.fail("Failed to parse backup file");
				console.log(colors.error("❌ Invalid JSON format"));
				await delay(2000);
				return;
			}
			if (!importData.mastercode || mastercode !== importData.mastercode) {
				spinner.fail("Incorrect master code for backup. Import cancelled.");
				await delay(1500);
				return;
			}
			ui.space();
			console.log(
				colors.warning(
					"⚠️  WARNING: This import will overwrite your vault with ALL data from the backup, including passwords and mastercode in plain text!",
				),
			);
			ui.space();

			spinner.text = "Validating backup data...";

			if (!importData.passwords || !Array.isArray(importData.passwords)) {
				throw new Error("Invalid backup format: missing passwords array");
			}

			const passwordsToImport = importData.passwords;

			if (passwordsToImport.length === 0) {
				spinner.warn("Backup contains no passwords");
				console.log(colors.muted("💡 The backup file is empty"));
				await delay(2500);
				return;
			}

			spinner.text = "Importing passwords...";

			const allPasswords = [...existingPasswords];
			let importedCount = 0;
			let skippedCount = 0;

			for (const password of passwordsToImport) {
				const isDuplicate = allPasswords.some(
					(existing) =>
						existing.nickname.toLowerCase() ===
							(password.nickname || password.title || "").toLowerCase() &&
						existing.url === (password.url || ""),
				);

				if (isDuplicate) {
					skippedCount++;
					continue;
				}

				const importedPassword: Password = {
					id: password.id || utils.generateId(),
					nickname: password.nickname || password.title || "Imported Password",
					username: password.username || "",
					value: password.value || "",
					url: password.url || "",
					category: password.category || "General",
					description: password.description || password.notes || "",
					createdAt: password.createdAt || new Date().toISOString(),
					updatedAt: new Date().toISOString(),
				};

				allPasswords.push(importedPassword);
				importedCount++;
			}

			await db.write("vault", "passwords", allPasswords);

			spinner.succeed("Import completed successfully!");

			ui.space();
			console.log(colors.success_bold("🎉 Import successful!"));
			ui.divider("─", 40, colors.success);
			console.log(
				`   ${colors.primary("File:")} ${colors.highlight(path.basename(filePath))}`,
			);
			console.log(
				`   ${colors.primary("Imported:")} ${colors.highlight(importedCount.toString())} passwords`,
			);
			if (skippedCount > 0) {
				console.log(
					`   ${colors.primary("Skipped:")} ${colors.warning(skippedCount.toString())} duplicates`,
				);
			}
			console.log(
				`   ${colors.primary("Total in vault:")} ${colors.highlight(allPasswords.length.toString())}`,
			);
			ui.divider("─", 40, colors.success);
			ui.space();

			if (importData.version) {
				console.log(colors.muted(`📦 Backup version: ${importData.version}`));
			}
			if (importData.exportDate) {
				console.log(
					colors.muted(
						`📅 Created: ${new Date(importData.exportDate).toLocaleDateString()}`,
					),
				);
			}

			await delay(3000);
		} catch (error) {
			spinner.fail("Failed to import backup");
			await errorHandler.handle(error as Error, "vault import");
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
			await errorHandler.handle(error as Error, "vault import");
		}
	}
	// Return to main menu will be handled automatically
}
