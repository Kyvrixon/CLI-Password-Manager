import * as y from "@inquirer/prompts";
import { colors, delay, errorHandler, ui, utils } from "../../utils/index.js";

export default async function deletePassword(): Promise<void> {
	try {
		ui.header("Delete Password", "Remove a password from your vault");

		spinner.start("Loading your password vault...");
		const existingData =
			(await db.read<PasswordData>("vault", "passwords")) || [];
		spinner.stop();

		if (existingData.length === 0) {
			ui.status.warning("Your vault is empty!");
			ui.space();
			console.log(
				colors.muted(
					"💡 Use the 'Add Password' option to create your first entry",
				),
			);
			await delay(2500);
			return;
		}

		ui.space();
		console.log(colors.primary("🗑️  Select a password to delete:"));
		ui.space();

		const selectedPasswordId = await y.search({
			message: colors.primary("Search for password to delete:"),
			source: async (input) => {
				const filtered = input
					? existingData.filter(
							(pwd) =>
								pwd.nickname.toLowerCase().includes(input.toLowerCase()) ||
								(pwd.description &&
									pwd.description
										.toLowerCase()
										.includes(input.toLowerCase())) ||
								(pwd.username &&
									pwd.username.toLowerCase().includes(input.toLowerCase())),
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
						]
							.filter(Boolean)
							.join(" • "),
					),
				}));
			},
			pageSize: 8,
			validate: (value) => !!value || "Please select a password to delete",
		});

		const passwordIndex = existingData.findIndex(
			(pwd) => pwd.id === selectedPasswordId,
		);
		if (passwordIndex === -1) {
			ui.status.error("Password not found");
			await delay(1500);
			return;
		}

		const passwordToDelete = existingData[passwordIndex];
		if (!passwordToDelete) {
			ui.status.error("Password not found");
			await delay(1500);
			return;
		}

		ui.space();
		console.log(
			colors.warning("⚠️  You are about to delete the following password:"),
		);
		ui.divider("─", 50, colors.warning);
		console.log(
			`   ${colors.brand("Name:")} ${colors.highlight(passwordToDelete.nickname)}`,
		);
		if (passwordToDelete.username) {
			console.log(
				`   ${colors.brand("Username:")} ${colors.text(passwordToDelete.username)}`,
			);
		}
		console.log(
			`   ${colors.brand("Description:")} ${colors.text(passwordToDelete.description)}`,
		);
		if (passwordToDelete.url) {
			console.log(
				`   ${colors.brand("URL:")} ${colors.primary(passwordToDelete.url)}`,
			);
		}
		if (passwordToDelete.category) {
			console.log(
				`   ${colors.brand("Category:")} ${colors.text(passwordToDelete.category)}`,
			);
		}
		console.log(
			`   ${colors.brand("Created:")} ${colors.muted(utils.formatDate(passwordToDelete.createdAt))}`,
		);
		ui.divider("─", 50, colors.warning);
		ui.space();

		console.log(colors.danger("🚨 DANGER ZONE"));
		console.log(colors.warning("This action cannot be undone!"));
		ui.space();

		const firstConfirm = await y.confirm({
			message: colors.warning("Are you sure you want to delete this password?"),
			default: false,
		});

		if (!firstConfirm) {
			console.log(colors.muted("💭 Deletion cancelled"));
			await delay(1000);
			return;
		}

		ui.space();
		console.log(
			colors.warning("🔐 Authentication required to delete password"),
		);
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
				colors.error("❌ Too many failed attempts. Deletion cancelled."),
			);
			await delay(2000);
			return;
		}

		ui.space();
		await y.input({
			message: colors.danger(
				`Type "${passwordToDelete.nickname}" to confirm deletion:`,
			),
			validate: (value) => {
				if (value === passwordToDelete.nickname) {
					return true;
				}
				return `You must type exactly "${passwordToDelete.nickname}" to confirm`;
			},
		});

		spinner.start("Deleting password from vault...");

		try {
			existingData.splice(passwordIndex, 1);
			await db.write("vault", "passwords", existingData);

			spinner.succeed("Password deleted successfully!");

			ui.space();
			console.log(colors.success("🗑️  Password deleted successfully"));
			console.log(
				colors.muted(
					`   Removed "${passwordToDelete.nickname}" from your vault`,
				),
			);

			const remainingCount = existingData.length;
			console.log(
				colors.muted(
					`   ${remainingCount} password${remainingCount !== 1 ? "s" : ""} remaining in vault`,
				),
			);
			ui.space();

			await delay(2500);
		} catch (error) {
			spinner.fail("Failed to delete password");
			await errorHandler.handle(error as Error, "password deletion");
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
			await errorHandler.handle(error as Error, "password deletion");
		}
	}
	// Return to main menu will be handled automatically
}
