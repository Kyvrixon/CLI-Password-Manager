import * as y from "@inquirer/prompts";
import { colors, delay, errorHandler, ui, utils } from "../../utils/index.js";

export default async function viewPasswords(): Promise<void> {
	try {
		ui.header("View Passwords", "Search and view your saved passwords");

		spinner.start("Loading your password vault...");

		const passwordData =
			(await db.read<PasswordData>("vault", "passwords")) || [];

		if (passwordData.length === 0) {
			spinner.warn("Your vault is empty!");
			ui.space();
			console.log(
				colors.muted(
					"💡 Use the 'Add Password' option to create your first entry",
				),
			);
			await delay(2500);
			return;
		}

		spinner.stop();

		const selectedPassword = await y.search({
			message: colors.primary("Search for a password:"),
			source: async (input) => {
				const filtered = input
					? passwordData.filter(
							(password) =>
								password.nickname.toLowerCase().includes(input.toLowerCase()) ||
								(password.description &&
									password.description
										.toLowerCase()
										.includes(input.toLowerCase())) ||
								(password.username &&
									password.username
										.toLowerCase()
										.includes(input.toLowerCase())) ||
								(password.url &&
									password.url.toLowerCase().includes(input.toLowerCase())),
						)
					: passwordData;

				return filtered.map((pwd) => ({
					name: `${colors.highlight(pwd.nickname)}${pwd.favorite ? " ⭐" : ""}`,
					value: pwd.id,
					description: colors.muted(
						[
							pwd.description,
							pwd.username && `👤 ${pwd.username}`,
							pwd.url && `🔗 ${utils.truncate(pwd.url, 30)}`,
							pwd.category && `📁 ${pwd.category}`,
						]
							.filter(Boolean)
							.join(" • "),
					),
				}));
			},
			pageSize: 8,
			validate: (value) => !!value || "Please select a password to view",
		});

		const password = passwordData.find((pwd) => pwd.id === selectedPassword);
		if (!password) {
			ui.status.error("Password not found");
			await delay(1500);
			return;
		}

		ui.space();
		console.log(colors.warning("🔐 Authentication required to view password"));
		console.log(
			colors.muted(`   Accessing: ${colors.highlight(password.nickname)}`),
		);
		ui.space();

		let attempts = 0;
		const maxAttempts = 3;
		let authenticated = false;

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
					console.log(
						colors.warning(
							`❌ Incorrect code. ${remaining} attempt${remaining > 1 ? "s" : ""} remaining.`,
						),
					);
					await delay(1000);
				}
			}
		}

		if (!authenticated) {
			console.log(
				colors.error("❌ Too many failed attempts. Returning to main menu."),
			);
			await delay(2000);
			return;
		}

		spinner.start("Decrypting password...");
		let decryptedPassword: string;

		try {
			decryptedPassword = await enc.decrypt(password.value);
			spinner.succeed("Password decrypted successfully!");
		} catch (error) {
			spinner.fail("Failed to decrypt password");
			await errorHandler.handle(error as Error, "password decryption");
			return;
		}

		await delay(1000);

		console.clear();
		ui.header("Password Details", `Viewing: ${password.nickname}`);

		ui.divider("═", 50, colors.primary);
		console.log(
			`${colors.brand("🔑 Name:")} ${colors.highlight(password.nickname)}`,
		);
		if (password.username) {
			console.log(
				`${colors.brand("👤 Username:")} ${colors.text(password.username)}`,
			);
		}
		console.log(
			`${colors.brand("🔒 Password:")} ${colors.success_bold(decryptedPassword)}`,
		);
		if (password.url) {
			console.log(`${colors.brand("🔗 URL:")} ${colors.primary(password.url)}`);
		}
		console.log(
			`${colors.brand("📝 Description:")} ${colors.text(password.description)}`,
		);
		ui.divider("═", 50, colors.primary);

		ui.space();
		console.log(colors.muted("📊 Metadata:"));
		console.log(
			colors.muted(`   Created: ${utils.formatDate(password.createdAt)}`),
		);
		console.log(
			colors.muted(`   Modified: ${utils.formatDate(password.updatedAt)}`),
		);
		if (password.category) {
			console.log(colors.muted(`   Category: ${password.category}`));
		}
		if (password.tags && password.tags.length > 0) {
			console.log(colors.muted(`   Tags: ${password.tags.join(", ")}`));
		}

		ui.space();
		const strength = utils.analyzePasswordStrength(decryptedPassword);
		const strengthColors = {
			"very-weak": colors.danger,
			weak: colors.warning,
			fair: colors.warning,
			good: colors.success,
			strong: colors.success_bold,
		};

		console.log(
			`${colors.brand("💪 Strength:")} ${strengthColors[strength.level](strength.level.toUpperCase())}`,
		);
		if (strength.feedback.length > 0) {
			console.log(
				colors.muted(`   Suggestions: ${strength.feedback.join(", ")}`),
			);
		}

		ui.space();
		ui.divider("─", 50, colors.muted);

		ui.space();
		console.log(colors.success("✅ Password viewed successfully!"));
		ui.space();

		await y.confirm({
			message: colors.primary("Return to main menu?"),
			default: true,
		});

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
			await errorHandler.handle(error as Error, "viewing passwords");
		}
	}
	// Return to main menu will be handled automatically
}
