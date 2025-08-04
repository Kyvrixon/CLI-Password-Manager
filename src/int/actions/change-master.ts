import * as y from "@inquirer/prompts";
import { colors, delay, errorHandler, ui, utils } from "../../utils/index.js";

export default async function changeMaster(): Promise<void> {
	try {
		ui.header(
			"Change Master Code",
			"Update your vault's master authentication",
		);

		ui.space();
		console.log(
			colors.warning(
				"🔐 This will change the master code for your entire vault",
			),
		);
		console.log(
			colors.muted(
				"   All stored passwords will be re-encrypted with the new code",
			),
		);
		ui.space();

		const currentMaster = await y.password({
			message: colors.primary("Enter your current master code:"),
			validate: (value) => {
				if (value.length < 4)
					return "Master code must be at least 4 characters";
				return true;
			},
		});

		spinner.start("Verifying current master code...");

		try {
			const userData = await db.read<UserData>("vault", "user");
			if (!userData || !userData.mastercode) {
				spinner.fail("No user data found");
				console.log(colors.error("❌ Unable to verify current master code"));
				await delay(2000);
				return;
			}

			try {
				await enc.decrypt(userData.mastercode);
			} catch {
				spinner.fail("Invalid master code");
				console.log(colors.error("❌ Current master code is incorrect"));
				await delay(2000);
				return;
			}

			spinner.succeed("Current master code verified");
		} catch (error) {
			spinner.fail("Failed to verify master code");
			await errorHandler.handle(error as Error, "master code verification");
			return;
		}

		ui.space();
		console.log(colors.success("✅ Current master code verified"));
		ui.space();

		let newMaster: string;
		let confirmMaster: string;

		do {
			newMaster = await y.password({
				message: colors.primary("Enter new master code (min 8 characters):"),
				validate: (value) => {
					if (value.length < 8)
						return "New master code must be at least 8 characters";
					if (value === currentMaster)
						return "New master code must be different from current";
					return true;
				},
			});

			const strength = utils.analyzePasswordStrength(newMaster);
			ui.space();

			let strengthColor: string;
			switch (strength.level) {
				case "very-weak":
					strengthColor = colors.danger("Very Weak");
					break;
				case "weak":
					strengthColor = colors.warning("Weak");
					break;
				case "fair":
					strengthColor = colors.info("Fair");
					break;
				case "good":
					strengthColor = colors.success("Good");
					break;
				case "strong":
					strengthColor = colors.success("Strong");
					break;
				default:
					strengthColor = colors.muted("Unknown");
			}

			console.log(`${colors.primary("Strength:")} ${strengthColor}`);

			if (strength.score < 3) {
				console.log(
					colors.warning("⚠️  Consider using a stronger master code"),
				);
				console.log(
					colors.muted(
						"   Tips: Use numbers, symbols, uppercase and lowercase letters",
					),
				);
			}

			if (strength.feedback.length > 0) {
				console.log(colors.muted("💡 Suggestions:"));
				strength.feedback.forEach((suggestion) => {
					console.log(colors.muted(`   • ${suggestion}`));
				});
			}
			ui.space();

			const useThisCode = await y.confirm({
				message: colors.primary("Use this master code?"),
				default: strength.score >= 3,
			});

			if (!useThisCode) {
				continue;
			}

			confirmMaster = await y.password({
				message: colors.primary("Confirm new master code:"),
				validate: (value) => {
					if (value !== newMaster) return "Codes do not match";
					return true;
				},
			});

			break;
		} while (true);

		ui.space();
		console.log(colors.warning("⚠️  Final Warning"));
		console.log(colors.muted("   This action cannot be undone"));
		console.log(
			colors.muted(
				"   If you forget the new master code, you will lose access to all passwords",
			),
		);
		ui.space();

		const finalConfirm = await y.confirm({
			message: colors.danger(
				"Are you absolutely sure you want to change the master code?",
			),
			default: false,
		});

		if (!finalConfirm) {
			console.log(colors.muted("👋 Master code change cancelled"));
			await delay(1500);
			return;
		}

		spinner.start("Changing master code...");

		try {
			spinner.text = "Reading vault data...";
			const passwordData =
				(await db.read<PasswordData>("vault", "passwords")) || [];
			const userData = await db.read<UserData>("vault", "user");

			if (!userData) {
				throw new Error("User data not found");
			}

			spinner.text = "Decrypting passwords...";
			const decryptedPasswords: Array<Password & { decryptedValue: string }> =
				[];

			const oldEnc = enc;

			for (const password of passwordData) {
				try {
					const decryptedValue = await oldEnc.decrypt(password.value);
					decryptedPasswords.push({
						...password,
						decryptedValue,
					});
				} catch (error) {
					throw new Error(`Failed to decrypt password: ${password.nickname}`);
				}
			}

			spinner.text = "Preparing new encryption...";
			const newEnc = new (await import("@kyvrixon/encryptor")).default(
				newMaster,
				{ iterations: 25000 },
			);

			spinner.text = "Re-encrypting passwords...";
			const reencryptedPasswords: PasswordData = [];

			for (const password of decryptedPasswords) {
				const newEncryptedValue = await newEnc.encrypt(password.decryptedValue);
				reencryptedPasswords.push({
					...password,
					value: newEncryptedValue,
					updatedAt: new Date().toISOString(),
				});

				delete (password as any).decryptedValue;
			}

			spinner.text = "Updating master code...";
			const hashedNewMaster = await enc.encrypt(newMaster);

			const updatedUserData: UserData = {
				...userData,
				mastercode: hashedNewMaster,
				lastLogin: new Date().toISOString(),
			};

			spinner.text = "Saving changes...";
			await db.write("vault", "passwords", reencryptedPasswords);
			await db.write("vault", "user", updatedUserData);

			globalThis.userData = updatedUserData;
			globalThis.enc = newEnc;

			spinner.succeed("Master code changed successfully!");

			ui.space();
			console.log(colors.success("🎉 Master code updated successfully!"));
			ui.divider("─", 40, colors.success);
			console.log(
				`   ${colors.primary("Passwords re-encrypted:")} ${colors.highlight(reencryptedPasswords.length.toString())}`,
			);
			console.log(
				`   ${colors.primary("Security level:")} ${colors.success("Enhanced")}`,
			);
			console.log(
				`   ${colors.primary("Changed at:")} ${colors.text(new Date().toLocaleString())}`,
			);
			ui.divider("─", 40, colors.success);
			ui.space();

			console.log(colors.warning("🔐 Important reminders:"));
			console.log(
				colors.muted("   • Use the new master code for all future logins"),
			);
			console.log(colors.muted("   • Consider updating any backup files"));
			console.log(colors.muted("   • Store the new code in a safe place"));
			ui.space();

			await delay(4000);
		} catch (error) {
			spinner.fail("Failed to change master code");

			ui.space();
			console.log(colors.error("❌ Master code change failed"));
			console.log(
				colors.muted(
					"   Your vault remains secure with the original master code",
				),
			);
			ui.space();

			await errorHandler.handle(error as Error, "master code change");
			await delay(3000);
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
			await errorHandler.handle(error as Error, "change master code");
		}
	}
	// Return to main menu will be handled automatically
}
