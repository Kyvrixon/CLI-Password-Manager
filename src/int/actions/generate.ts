import { mainmenu } from "../main-menu.js";
import * as y from "@inquirer/prompts";
import { colors, ui, utils, delay, errorHandler } from "../../utils/index.js";

async function savePasswordEntry(passwordToSave: string): Promise<void> {
	ui.space();
	console.log(colors.highlight("💾 Quick Save Password Entry:"));
	ui.space();

	// Get basic details for quick save
	const nickname = await y.input({
		message: colors.primary("🏷️  Nickname:"),
		validate: (value) => {
			const trimmed = value.trim();
			if (!trimmed) return "Nickname is required";
			if (trimmed.length < 2) return "Nickname must be at least 2 characters";
			return true;
		},
	});

	const description = await y.input({
		message: colors.primary("📝 Description:"),
		validate: (value) => {
			const trimmed = value.trim();
			if (!trimmed) return "Description is required";
			if (trimmed.length < 3) return "Description must be at least 3 characters";
			return true;
		},
	});

	// Save the password
	spinner.start("Saving password to vault...");

	try {
		const existingData = await db.read<PasswordData>("vault", "passwords") || [];
		
		// Check for duplicate nickname
		const duplicate = existingData.find(pwd => 
			pwd.nickname.toLowerCase() === nickname.trim().toLowerCase()
		);
		
		if (duplicate) {
			spinner.fail("Nickname already exists");
			ui.status.error("Please choose a different nickname");
			await delay(2000);
			throw new Error("Duplicate nickname");
		}

		const encryptedPassword = await enc.encrypt(passwordToSave);
		const now = utils.timestamp();

		const newPassword: Password = {
			id: utils.generateId(),
			nickname: nickname.trim(),
			value: encryptedPassword,
			description: description.trim(),
			createdAt: now,
			updatedAt: now,
		};

		existingData.push(newPassword);
		await db.write("vault", "passwords", existingData);

		spinner.succeed("Password saved successfully!");
		
		ui.space();
		console.log(colors.success_bold("🎉 Password saved to vault!"));
		console.log(colors.muted(`   Added "${nickname}" with generated password`));
		ui.space();
		
		await delay(2000);

	} catch (error) {
		spinner.fail("Failed to save password");
		if (error instanceof Error && error.message !== "Duplicate nickname") {
			await errorHandler.handle(error, "password saving");
		}
		throw error;
	}
}

export default async function generatePassword(): Promise<void> {
	try {
		ui.header("Password Generator", "Create strong, secure passwords");

		ui.space();
		console.log(colors.primary("🎲 Configure your password generation:"));
		ui.space();

		// Password length
		const length = await y.number({
			message: colors.primary("Password length:"),
			default: 16,
			min: 4,
			max: 128,
			validate: (value) => {
				if (value === undefined || value === null) return "Please enter a valid number";
				if (value < 4) return "Password must be at least 4 characters";
				if (value > 128) return "Password must be less than 128 characters";
				return true;
			},
		});

		// Character set options
		const includeUppercase = await y.confirm({
			message: colors.primary("Include uppercase letters (A-Z)?"),
			default: true,
		});

		const includeLowercase = await y.confirm({
			message: colors.primary("Include lowercase letters (a-z)?"),
			default: true,
		});

		const includeNumbers = await y.confirm({
			message: colors.primary("Include numbers (0-9)?"),
			default: true,
		});

		const includeSymbols = await y.confirm({
			message: colors.primary("Include symbols (!@#$%^&*)?"),
			default: true,
		});

		const excludeSimilar = await y.confirm({
			message: colors.primary("Exclude similar characters (0,O,l,1,I)?"),
			default: true,
		});

		// Validate at least one character set is selected
		if (!includeUppercase && !includeLowercase && !includeNumbers && !includeSymbols) {
			ui.status.error("At least one character set must be selected");
			await delay(2000);
			return generatePassword();
		}

		// Generate multiple password options
		ui.space();
		spinner.start("Generating secure passwords...");
		await delay(800);

		const passwords: string[] = [];
		const strengths: Array<{ password: string, analysis: any }> = [];

		try {
			// Generate 5 different passwords
			for (let i = 0; i < 5; i++) {
				const password = utils.generatePassword(length!, {
					includeUppercase,
					includeLowercase,
					includeNumbers,
					includeSymbols,
					excludeSimilar,
				});
				passwords.push(password);
				
				const analysis = utils.analyzePasswordStrength(password);
				strengths.push({ password, analysis });
			}

			spinner.succeed("Passwords generated!");

		} catch (error) {
			spinner.fail("Failed to generate passwords");
			await errorHandler.handle(error as Error, "password generation");
			return; // Return to main menu
		}

		// Display password options
		ui.space();
		console.log(colors.highlight("🎯 Generated Password Options:"));
		ui.divider("═", 60, colors.primary);

		strengths.forEach((item, index) => {
			const strengthColors: Record<string, (str: string) => string> = {
				"very-weak": colors.danger,
				"weak": colors.warning,
				"fair": colors.warning,
				"good": colors.success,
				"strong": colors.success_bold,
			};

			console.log(`${colors.brand(`${index + 1}.`)} ${colors.highlight(item.password)}`);
			console.log(`   ${colors.muted("Strength:")} ${strengthColors[item.analysis.level]?.(item.analysis.level.toUpperCase()) || colors.muted("Unknown")}`);
			console.log(`   ${colors.muted("Length:")} ${item.password.length} characters`);
			ui.space();
		});

		ui.divider("═", 60, colors.primary);

		// Simple confirmation to continue
		ui.space();
		console.log(colors.success("✅ Passwords generated successfully!"));
		console.log(colors.warning("💡 Copy any passwords you want to use before continuing"));
		ui.space();
		
		try {
			await y.confirm({
				message: colors.primary("Press Enter to return to main menu"),
				default: true
			});
		} catch (confirmError) {
			console.log(colors.muted("👋 Returning to main menu..."));
			await delay(500);
		}

		return; // Return to main menu

	} catch (error) {
		if (error && typeof error === 'object' && 'message' in error && 
			typeof error.message === 'string' && error.message.includes("User forced exit")) {
			console.log(colors.muted("\n👋 Returning to main menu..."));
			await delay(500);
		} else {
			await errorHandler.handle(error as Error, "password generation");
		}
	}
	// Return to main menu will be handled automatically
}
