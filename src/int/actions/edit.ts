import { mainmenu } from "../main-menu.js";
import * as y from "@inquirer/prompts";
import { colors, ui, utils, delay, errorHandler } from "../../utils/index.js";

export default async function editPassword(): Promise<void> {
	try {
		ui.header("Edit Password", "Modify an existing password entry");

		spinner.start("Loading your password vault...");
		const existingData = await db.read<PasswordData>("vault", "passwords") || [];
		spinner.stop();

		if (existingData.length === 0) {
			ui.status.warning("Your vault is empty!");
			ui.space();
			console.log(colors.muted("💡 Use the 'Add Password' option to create your first entry"));
			await delay(2500);
			return; // Return to main menu
		}

		ui.space();
		console.log(colors.primary("📝 Select a password to edit:"));
		ui.space();

		// Enhanced password selection
		const selectedPasswordId = await y.search({
			message: colors.primary("Search for password to edit:"),
			source: async (input) => {
				const filtered = input
					? existingData.filter((pwd) =>
							pwd.nickname.toLowerCase().includes(input.toLowerCase()) ||
							(pwd.description && pwd.description.toLowerCase().includes(input.toLowerCase())) ||
							(pwd.username && pwd.username.toLowerCase().includes(input.toLowerCase()))
						)
					: existingData;

				return filtered.map((pwd) => ({
					name: `${colors.highlight(pwd.nickname)}${pwd.favorite ? " ⭐" : ""}`,
					value: pwd.id,
					description: colors.muted(
						[
							pwd.description,
							pwd.username && `👤 ${pwd.username}`,
							pwd.category && `📁 ${pwd.category}`,
						].filter(Boolean).join(" • ")
					),
				}));
			},
			pageSize: 8,
			validate: (value) => !!value || "Please select a password to edit",
		});

		const passwordIndex = existingData.findIndex(pwd => pwd.id === selectedPasswordId);
		if (passwordIndex === -1) {
			ui.status.error("Password not found");
			await delay(1500);
			return; // Return to main menu
		}

		const currentPassword = existingData[passwordIndex];
		if (!currentPassword) {
			ui.status.error("Password not found");
			await delay(1500);
			return; // Return to main menu
		}

		// Master code verification
		ui.space();
		console.log(colors.warning("🔐 Authentication required to edit password"));
		console.log(colors.muted(`   Editing: ${colors.highlight(currentPassword.nickname)}`));
		ui.space();

		let authenticated = false;
		let attempts = 0;
		const maxAttempts = 3;

		while (attempts < maxAttempts && !authenticated) {
			const mastercode = await y.password({
				message: colors.primary("Enter your master code:"),
			});

			if (mastercode === globalThis.userData.mastercode) {
				authenticated = true;
			} else {
				attempts++;
				const remaining = maxAttempts - attempts;
				if (remaining > 0) {
					console.log(colors.warning(`❌ Incorrect code. ${remaining} attempt${remaining > 1 ? 's' : ''} remaining.`));
					await delay(1000);
				}
			}
		}

		if (!authenticated) {
			console.log(colors.error("❌ Too many failed attempts. Returning to main menu."));
			await delay(2000);
			return; // Return to main menu
		}

		// Show current values and collect new ones
		ui.space();
		console.log(colors.highlight("📋 Current values (press Enter to keep unchanged):"));
		ui.space();

		// Edit nickname
		const nickname = await y.input({
			message: colors.primary("🏷️  Nickname:"),
			default: currentPassword.nickname,
			validate: (value) => {
				const trimmed = value.trim();
				if (!trimmed) return "Nickname is required";
				if (trimmed.length < 2) return "Nickname must be at least 2 characters";
				if (trimmed.length > 50) return "Nickname must be less than 50 characters";
				
				// Check for duplicates (excluding current password)
				const existing = existingData.find((pwd, idx) => 
					idx !== passwordIndex && 
					pwd.nickname.toLowerCase() === trimmed.toLowerCase()
				);
				if (existing) {
					return "This nickname already exists. Please choose a different one.";
				}
				return true;
			},
		});

		// Edit username
		const username = await y.input({
			message: colors.primary("👤 Username/Email:"),
			default: currentPassword.username || "",
			validate: (value) => {
				if (!value.trim()) return true; // Optional field
				if (value.includes("@") && !utils.isValidEmail(value)) {
					return "Please enter a valid email address";
				}
				return true;
			},
		});

		// Password change option
		const changePassword = await y.confirm({
			message: colors.primary("🔒 Change password?"),
			default: false,
		});

		let newPassword = currentPassword.value; // Keep encrypted value by default
		
		if (changePassword) {
			const passwordChoice = await y.select({
				message: colors.primary("How would you like to set the new password?"),
				choices: [
					{
						name: "🎲 Generate a strong password",
						value: "generate",
					},
					{
						name: "✏️  Enter manually",
						value: "manual",
					},
				],
			});

			let plaintextPassword: string;

			if (passwordChoice === "generate") {
				// Generate new password
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

				plaintextPassword = utils.generatePassword(length, {
					includeUppercase: true,
					includeLowercase: true,
					includeNumbers: true,
					includeSymbols,
					excludeSimilar: true,
				});

				console.log(`   Generated: ${colors.highlight(plaintextPassword)}`);
				
				const accept = await y.confirm({
					message: colors.primary("Use this password?"),
					default: true,
				});

				if (!accept) {
					console.log(colors.muted("Password not changed"));
					plaintextPassword = ""; // Will skip encryption
				}

			} else {
				// Manual password entry
				plaintextPassword = await y.password({
					message: colors.primary("🔒 New password:"),
					validate: (value) => {
						if (!value.trim()) return "Password cannot be empty";
						return true;
					},
				});
			}

			if (plaintextPassword) {
				spinner.start("Encrypting new password...");
				try {
					newPassword = await enc.encrypt(plaintextPassword);
					spinner.succeed("Password encrypted!");
				} catch (error) {
					spinner.fail("Failed to encrypt password");
					await errorHandler.handle(error as Error, "password encryption");
					return; // Return to main menu
				}
			}
		}

		// Edit URL
		const url = await y.input({
			message: colors.primary("🔗 Website URL:"),
			default: currentPassword.url || "",
			validate: (value) => {
				if (!value.trim()) return true; // Optional field
				if (!utils.isValidUrl(value)) {
					return "Please enter a valid URL (including http:// or https://)";
				}
				return true;
			},
		});

		// Edit description
		const description = await y.input({
			message: colors.primary("📝 Description:"),
			default: currentPassword.description,
			validate: (value) => {
				const trimmed = value.trim();
				if (!trimmed) return "Description is required";
				if (trimmed.length < 3) return "Description must be at least 3 characters";
				if (trimmed.length > 200) return "Description must be less than 200 characters";
				return true;
			},
		});

		// Edit category
		const category = await y.input({
			message: colors.primary("📁 Category:"),
			default: currentPassword.category || "",
			validate: (value) => {
				if (!value.trim()) return true; // Optional field
				if (value.length > 30) return "Category must be less than 30 characters";
				return true;
			},
		});

		// Edit tags
		const currentTags = currentPassword.tags ? currentPassword.tags.join(", ") : "";
		const tagsInput = await y.input({
			message: colors.primary("🏷️  Tags (comma-separated):"),
			default: currentTags,
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

		// Edit favorite status
		const favorite = await y.confirm({
			message: colors.primary("⭐ Mark as favorite?"),
			default: currentPassword.favorite || false,
		});

		// Summary of changes
		ui.space();
		console.log(colors.highlight("📋 Updated password details:"));
		ui.divider("─", 30, colors.muted);
		console.log(`   Nickname: ${colors.primary(nickname)}`);
		if (username.trim()) console.log(`   Username: ${colors.text(username)}`);
		if (changePassword && newPassword !== currentPassword!.value) {
			console.log(`   Password: ${colors.success("✅ Updated")}`);
		} else {
			console.log(`   Password: ${colors.muted("No change")}`);
		}
		if (url.trim()) console.log(`   URL: ${colors.primary(url)}`);
		console.log(`   Description: ${colors.text(description)}`);
		if (category.trim()) console.log(`   Category: ${colors.text(category)}`);
		if (tags && tags.length > 0) console.log(`   Tags: ${colors.text(tags.join(", "))}`);
		if (favorite) console.log(`   ${colors.warning("⭐ Favorite")}`);
		ui.divider("─", 30, colors.muted);
		ui.space();

		const confirmSave = await y.confirm({
			message: colors.primary("Save changes?"),
			default: true,
		});

		if (!confirmSave) {
			console.log(colors.muted("💭 Changes not saved"));
			await delay(1000);
			return; // Return to main menu
		}

		// Save changes
		spinner.start("Saving changes...");

		try {
			const updatedPassword: Password = {
				...currentPassword!,
				nickname: nickname.trim(),
				username: username.trim() || undefined,
				value: newPassword,
				url: url.trim() || undefined,
				description: description.trim(),
				category: category.trim() || undefined,
				tags,
				favorite,
				updatedAt: utils.timestamp(),
			};

			existingData[passwordIndex] = updatedPassword;
			await db.write("vault", "passwords", existingData);

			spinner.succeed("Password updated successfully!");
			
			ui.space();
			console.log(colors.success_bold("🎉 Password updated successfully!"));
			console.log(colors.muted(`   Modified "${nickname}"`));
			ui.space();
			
			await delay(2000);

		} catch (error) {
			spinner.fail("Failed to save changes");
			await errorHandler.handle(error as Error, "password update");
		}

	} catch (error) {
		if (error && typeof error === 'object' && 'message' in error && 
			typeof error.message === 'string' && error.message.includes("User forced exit")) {
			console.log(colors.muted("\n👋 Returning to main menu..."));
			await delay(500);
		} else {
			await errorHandler.handle(error as Error, "password editing");
		}
	}
	// Return to main menu will be handled automatically
}
