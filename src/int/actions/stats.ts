import * as y from "@inquirer/prompts";
import { colors, delay, errorHandler, ui, utils } from "../../utils/index.js";

export default async function showVaultStats(): Promise<void> {
	try {
		ui.header("Vault Statistics", "Analyze your password vault health");

		spinner.start("Analyzing your password vault...");

		const passwordData =
			(await db.read<PasswordData>("vault", "passwords")) || [];
		const userData = globalThis.userData;

		await delay(1000);

		spinner.stop();

		if (passwordData.length === 0) {
			ui.space();
			console.log(colors.warning("📭 Your vault is empty!"));
			ui.space();
			console.log(
				colors.muted(
					"💡 Use the 'Add Password' option to start building your password vault",
				),
			);
			ui.space();
			await delay(3000);
			return;
		}

		const stats = utils.calculateVaultStats(passwordData);
		const vaultAge = userData
			? Math.floor(
					(Date.now() - new Date(userData.createdAt).getTime()) /
						(1000 * 60 * 60 * 24),
				)
			: 0;

		const categoryStats = stats.categories.reduce(
			(acc, category) => {
				acc[category] = passwordData.filter(
					(p) => p.category === category,
				).length;
				return acc;
			},
			{} as Record<string, number>,
		);

		const now = new Date();
		const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
		const recentlyAdded = passwordData.filter(
			(p) => new Date(p.createdAt) > oneWeekAgo,
		).length;
		const recentlyModified = passwordData.filter(
			(p) => new Date(p.updatedAt) > oneWeekAgo && p.createdAt !== p.updatedAt,
		).length;

		const favoriteCount = passwordData.filter((p) => p.favorite).length;

		ui.space();
		console.log(colors.brand("📊 Vault Overview"));
		ui.divider("═", 50, colors.primary);

		console.log(
			`${colors.highlight("🔐 Total Passwords:")} ${colors.success_bold(stats.totalPasswords.toString())}`,
		);
		console.log(
			`${colors.highlight("📁 Categories:")} ${colors.primary(stats.categories.length.toString())}`,
		);
		console.log(
			`${colors.highlight("⭐ Favorites:")} ${colors.warning(favoriteCount.toString())}`,
		);
		console.log(
			`${colors.highlight("📅 Vault Age:")} ${colors.muted(vaultAge.toString() + " days")}`,
		);

		ui.divider("─", 50, colors.muted);

		console.log(colors.secondary("📈 Recent Activity (Last 7 days)"));
		console.log(
			`   ${colors.primary("New passwords:")} ${colors.success(recentlyAdded.toString())}`,
		);
		console.log(
			`   ${colors.primary("Modified passwords:")} ${colors.warning(recentlyModified.toString())}`,
		);

		if (stats.categories.length > 0) {
			ui.space();
			console.log(colors.secondary("📂 Password Categories"));
			stats.categories.forEach((category) => {
				const count = categoryStats[category] || 0;
				const percentage = Math.round((count / stats.totalPasswords) * 100);
				const bar = "█".repeat(Math.floor(percentage / 5));
				console.log(
					`   ${colors.primary(category.padEnd(15))} ${colors.highlight(count.toString().padStart(3))} ${colors.muted(`(${percentage}%)`)} ${colors.success(bar)}`,
				);
			});
		}

		const uncategorized = passwordData.filter((p) => !p.category).length;
		if (uncategorized > 0) {
			ui.space();
			console.log(
				colors.warning(
					`⚠️  ${uncategorized} password${uncategorized > 1 ? "s" : ""} without category`,
				),
			);
		}

		ui.divider("═", 50, colors.primary);

		ui.space();
		console.log(colors.brand("👤 Account Information"));
		ui.divider("─", 30, colors.muted);

		if (userData) {
			console.log(
				`   ${colors.primary("Name:")} ${colors.highlight(userData.name)}`,
			);
			console.log(
				`   ${colors.primary("Created:")} ${colors.muted(utils.formatDate(userData.createdAt))}`,
			);
			if (userData.lastLogin) {
				console.log(
					`   ${colors.primary("Last Login:")} ${colors.muted(utils.formatDate(userData.lastLogin))}`,
				);
			}
			if (userData.settings) {
				ui.space();
				console.log(colors.secondary("⚙️  Current Settings"));
				console.log(
					`   ${colors.primary("Theme:")} ${colors.text(userData.settings.theme || "default")}`,
				);
				console.log(
					`   ${colors.primary("Confirm Deletions:")} ${userData.settings.confirmDeletions ? colors.success("Yes") : colors.warning("No")}`,
				);
				console.log(
					`   ${colors.primary("Show Password Strength:")} ${userData.settings.showPasswordStrength ? colors.success("Yes") : colors.warning("No")}`,
				);
			}
		}

		ui.space();
		console.log(colors.brand("💡 Recommendations"));
		ui.divider("─", 30, colors.warning);

		const recommendations: string[] = [];

		if (uncategorized > 0) {
			recommendations.push(
				`Organize ${uncategorized} uncategorized password${uncategorized > 1 ? "s" : ""}`,
			);
		}

		if (favoriteCount === 0 && stats.totalPasswords > 3) {
			recommendations.push(
				"Consider marking frequently used passwords as favorites",
			);
		}

		if (stats.categories.length === 0 && stats.totalPasswords > 5) {
			recommendations.push(
				"Create categories to better organize your passwords",
			);
		}

		if (recentlyAdded === 0 && recentlyModified === 0) {
			recommendations.push(
				"Review and update old passwords for better security",
			);
		}

		if (stats.totalPasswords < 5) {
			recommendations.push("Add more passwords to build a comprehensive vault");
		}

		if (recommendations.length === 0) {
			console.log(
				colors.success("   🎉 Great job! Your vault is well organized."),
			);
		} else {
			recommendations.forEach((rec, index) => {
				console.log(
					`   ${colors.warning(`${index + 1}.`)} ${colors.text(rec)}`,
				);
			});
		}

		ui.divider("═", 50, colors.primary);

		ui.space();
		const action = await y.select({
			message: colors.primary("What would you like to do?"),
			choices: [
				{
					name: "🔄 Refresh Statistics",
					value: "refresh",
					description: "Recalculate vault statistics",
				},
				// TODO: Enable export functionality in future
				// {
				// 	name: "📋 Export Vault Summary",
				// 	value: "export",
				// 	description: "Save statistics to a file"
				// },
				{
					name: "🔙 Back to Main Menu",
					value: "back",
					description: "Return to main menu",
				},
			],
		});

		switch (action) {
			case "refresh":
				console.log(colors.muted("\n🔄 Refreshing statistics..."));
				await delay(1000);
				return showVaultStats();

			case "export":
				spinner.start("Generating vault summary...");
				await delay(1000);

				const summary = {
					generatedAt: new Date().toISOString(),
					vaultStats: stats,
					categoryBreakdown: categoryStats,
					recentActivity: {
						recentlyAdded,
						recentlyModified,
					},
					recommendations,
					user: userData
						? {
								name: userData.name,
								vaultAge,
								totalPasswords: stats.totalPasswords,
							}
						: null,
				};

				spinner.succeed("Summary generated!");
				console.log(colors.success("\n📄 Vault Summary:"));
				console.log(colors.muted(JSON.stringify(summary, null, 2)));
				ui.space();

				await y.confirm({
					message: colors.primary("Press Enter to continue"),
					default: true,
				});

				// Return to main menu
				break;

			case "back":
			default:
				// Return to main menu
				break;
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
			await errorHandler.handle(error as Error, "vault statistics");
		}
	}
	// Return to main menu will be handled automatically
}
