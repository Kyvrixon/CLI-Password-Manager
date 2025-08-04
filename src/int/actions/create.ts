import { mainmenu } from "../main-menu.js";
import * as y from "@inquirer/prompts";
import { colors, ui, utils, delay, errorHandler } from "../../utils/index.js";

export default async function createPassword(): Promise<void> {
	try {
		ui.header("Add New Password", "Create a secure password entry");

		spinner.start("Loading your vault...");

		const existingData = await db.read<PasswordData>("vault", "passwords") || [];

		spinner.stop();

		ui.space();
		console.log(colors.primary("📝 Fill in the password details:"));
		ui.space();

		// Step 1: Nickname (required, unique)
		const nickname = await y.input({
			message: colors.primary("🏷️  Nickname (display name):"),
			validate: (value) => {
				const trimmed = value.trim();
				if (!trimmed) return "Nickname is required";
				if (trimmed.length < 2) return "Nickname must be at least 2 characters";
				if (trimmed.length > 50) return "Nickname must be less than 50 characters";
				
				// Check for duplicates
				const existing = existingData.find(pwd => 
					pwd.nickname.toLowerCase() === trimmed.toLowerCase()
				);
				if (existing) {
					return "This nickname already exists. Please choose a different one.";
				}
				return true;
			},
		});

		// Step 2: Username (optional)
		const username = await y.input({
			message: colors.primary("👤 Username/Email (optional):"),
			validate: (value) => {
				if (!value.trim()) return true; // Optional field
				if (value.includes("@") && !utils.isValidEmail(value)) {
					return "Please enter a valid email address";
				}
				return true;
			},
		});

		// Step 3: Password generation or manual entry
		const passwordChoice = await y.select({
			message: colors.primary("🔒 How would you like to set the password?"),
			choices: [
				{
					name: "🎲 Generate a strong password",
					value: "generate",
					description: "Automatically create a secure random password",
				},
				{
					name: "✏️  Enter manually",
					value: "manual",
					description: "Type your own password",
				},
			],
		});

		let password: string;

		if (passwordChoice === "generate") {
			// Password generation options
			ui.space();
			console.log(colors.secondary("🎲 Password Generation Options:"));
			ui.space();

			const length = await y.number({
				message: colors.primary("Password length:"),
				default: 16,
				min: 8,
				max: 128,
				validate: (value) => {
					if (value === undefined || value === null) return "Please enter a valid number";
					if (value < 8) return "Password must be at least 8 characters";
					if (value > 128) return "Password must be less than 128 characters";
					return true;
				},
			});

			const includeSymbols = await y.confirm({
				message: colors.primary("Include symbols (!@#$%^&*)?"),
				default: true,
			});

			const excludeSimilar = await y.confirm({
				message: colors.primary("Exclude similar characters (0,O,l,1,I)?"),
				default: true,
			});

			spinner.start("Generating secure password...");
			await delay(500);

			password = utils.generatePassword(length, {
				includeUppercase: true,
				includeLowercase: true,
				includeNumbers: true,
				includeSymbols,
				excludeSimilar,
			});

			spinner.succeed("Password generated!");

			// Show strength
			const strength = utils.analyzePasswordStrength(password);
			const strengthColors = {
				"very-weak": colors.danger,
				"weak": colors.warning,
				"fair": colors.warning,
				"good": colors.success,
				"strong": colors.success_bold,
			};
			
			console.log(`   Generated password: ${colors.highlight(password)}`);
			console.log(`   Strength: ${strengthColors[strength.level](strength.level.toUpperCase())}`);
			ui.space();

			const acceptGenerated = await y.confirm({
				message: colors.primary("Use this password?"),
				default: true,
			});

			if (!acceptGenerated) {
				console.log(colors.warning("⚠️  Password rejected. Returning to main menu."));
				await delay(1500);
				return; // Return to main menu
			}

		} else {
			// Manual password entry
			password = await y.password({
				message: colors.primary("🔒 Password:"),
				validate: (value) => {
					if (!value.trim()) return "Password is required";
					if (value.length < 1) return "Password cannot be empty";
					return true;
				},
			});

			// Show password strength for manual entry
			const strength = utils.analyzePasswordStrength(password);
			const strengthColors = {
				"very-weak": colors.danger,
				"weak": colors.warning,
				"fair": colors.warning,
				"good": colors.success,
				"strong": colors.success_bold,
			};
			
			console.log(`   Strength: ${strengthColors[strength.level](strength.level.toUpperCase())}`);
			if (strength.feedback.length > 0) {
				console.log(colors.muted(`   Suggestions: ${strength.feedback.join(", ")}`));
			}
			ui.space();
		}

		// Step 4: URL (optional)
		const url = await y.input({
			message: colors.primary("🔗 Website URL (optional):"),
			validate: (value) => {
				if (!value.trim()) return true; // Optional field
				if (!utils.isValidUrl(value)) {
					return "Please enter a valid URL (including http:// or https://)";
				}
				return true;
			},
		});

		// Step 5: Description (required)
		const description = await y.input({
			message: colors.primary("📝 Description:"),
			validate: (value) => {
				const trimmed = value.trim();
				if (!trimmed) return "Description is required";
				if (trimmed.length < 3) return "Description must be at least 3 characters";
				if (trimmed.length > 200) return "Description must be less than 200 characters";
				return true;
			},
		});

		// Step 6: Category (optional)
		const category = await y.input({
			message: colors.primary("📁 Category (optional):"),
			validate: (value) => {
				if (!value.trim()) return true; // Optional field
				if (value.length > 30) return "Category must be less than 30 characters";
				return true;
			},
		});

		// Step 7: Tags (optional)
		const tagsInput = await y.input({
			message: colors.primary("🏷️  Tags (comma-separated, optional):"),
			validate: (value) => {
				if (!value.trim()) return true; // Optional field
				const tags = value.split(",").map(tag => tag.trim());
				if (tags.some(tag => tag.length > 20)) {
					return "Each tag must be less than 20 characters";
				}
				if (tags.length > 10) {
					return "Maximum 10 tags allowed";
				}
				return true;
			},
		});

		const tags = tagsInput.trim() ? 
			tagsInput.split(",").map(tag => tag.trim()).filter(tag => tag.length > 0) : 
			undefined;

		// Step 8: Favorite flag
		const favorite = await y.confirm({
			message: colors.primary("⭐ Mark as favorite?"),
			default: false,
		});

		// Summary before saving
		ui.space();
		console.log(colors.highlight("📋 Summary:"));
		ui.divider("─", 30, colors.muted);
		console.log(`   Nickname: ${colors.primary(nickname)}`);
		if (username.trim()) console.log(`   Username: ${colors.text(username)}`);
		console.log(`   Password: ${colors.muted("•".repeat(Math.min(password.length, 12)))}`);
		if (url.trim()) console.log(`   URL: ${colors.primary(url)}`);
		console.log(`   Description: ${colors.text(description)}`);
		if (category.trim()) console.log(`   Category: ${colors.text(category)}`);
		if (tags && tags.length > 0) console.log(`   Tags: ${colors.text(tags.join(", "))}`);
		if (favorite) console.log(`   ${colors.warning("⭐ Favorite")}`);
		ui.divider("─", 30, colors.muted);
		ui.space();

		const confirmSave = await y.confirm({
			message: colors.primary("Save this password?"),
			default: true,
		});

		if (!confirmSave) {
			console.log(colors.muted("💭 Password not saved"));
			await delay(1000);
			return; // Return to main menu
		}

		// Encrypt and save password
		spinner.start("Encrypting and saving password...");

		try {
			const encryptedPassword = await enc.encrypt(password);
			const now = utils.timestamp();

			const newPassword: Password = {
				id: utils.generateId(),
				nickname: nickname.trim(),
				value: encryptedPassword,
				description: description.trim(),
				username: username.trim() || undefined,
				url: url.trim() || undefined,
				category: category.trim() || undefined,
				tags,
				favorite,
				createdAt: now,
				updatedAt: now,
			};

			existingData.push(newPassword);
			await db.write("vault", "passwords", existingData);

			spinner.succeed("Password saved successfully!");
			
			// Success message
			ui.space();
			console.log(colors.success_bold("🎉 Password created successfully!"));
			console.log(colors.muted(`   Added "${nickname}" to your vault`));
			ui.space();
			
			await delay(2000);

		} catch (error) {
			spinner.fail("Failed to save password");
			await errorHandler.handle(error as Error, "password creation");
		}

	} catch (error) {
		if (error && typeof error === 'object' && 'message' in error && 
			typeof error.message === 'string' && error.message.includes("User forced exit")) {
			console.log(colors.muted("\n👋 Returning to main menu..."));
			await delay(500);
		} else {
			await errorHandler.handle(error as Error, "password creation");
		}
	}
	// Return to main menu will be handled automatically
}
