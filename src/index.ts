import Database from "@kyvrixon/json-db";
import { mainmenu } from "./int/main-menu.js";
import { homedir } from "os";
import ora from "ora";
import path from "path";
import fs from "fs";
import * as y from "@inquirer/prompts";
import Encryptor from "@kyvrixon/encryptor";
import { colors, ui, utils, delay, errorHandler } from "./utils/index.js";

const APP_VERSION = "1.0.0";
const APP_NAME = "Kyvrixon CLI Password Manager";

// Global Ctrl+C handler for emergency fallback to main menu
function setupGlobalSignalHandlers() {
	process.on('SIGINT', () => {
		console.log(colors.warning("\n\n🔄 Ctrl+C detected - Force exiting to main menu..."));
		
		// Force clear all input streams
		if (process.stdin) {
			process.stdin.pause();
			process.stdin.removeAllListeners();
		}
		
		// Clear screen
		process.stdout.write('\x1B[2J\x1B[H');
		
		// Force exit and restart
		console.log(colors.muted("Application will restart...\n"));
		setTimeout(() => {
			process.exit(0);
		}, 500);
	});

	process.on('SIGTERM', async () => {
		console.log(colors.muted("\n\n👋 Application terminated. Stay secure."));
		process.exit(0);
	});
}

async function checkForUpdates() {
	try {
		const localPkgPath = path.join(__dirname, "..", "package.json");
		const localPkg = JSON.parse(
			await fs.promises.readFile(localPkgPath, "utf8"),
		);
		const localVersion = localPkg.version;

		const res = await fetch(
			"https://api.github.com/repos/Kyvrixon/CLI-Password-Manager/releases/latest",
			{ headers: { "Accept": "application/vnd.github.v3+json" } }
		);

		if (res.ok) {
			const release = await res.json() as { tag_name: string };
			const remoteVersion = release.tag_name.startsWith("v") ? release.tag_name.slice(1) : release.tag_name;

			if (localVersion !== remoteVersion) {
				ui.space();
				ui.divider("━", 50, colors.muted);
				console.log(colors.warning("✨  A new version is available!"));
				console.log(colors.muted(`   Current: ${localVersion}`));
				console.log(colors.success_bold(`   Latest: ${remoteVersion}`));
				console.log(`   Visit ${colors.primary("https://github.com/Kyvrixon/CLI-Password-Manager/releases")} to update.`);
				ui.divider("━", 50, colors.muted);
				ui.space();
				await delay(2000);
			}
		}
	} catch (error) {
		console.log(
			colors.muted("⚠️  Could not check for updates. Internet connection may be unavailable."),
		);
		await delay(1000);
	}
}

async function initializeDatabase() {
	const dbPath = path.join(
		homedir(),
		"Kyvrixon Development",
		"CLI Password Manager",
		"data",
	);

	globalThis.db = new Database(dbPath, { 
		createDirectory: true,
	});

	return await db.read<UserData>("users", "creds");
}

async function setupNewUser(): Promise<UserData> {
	ui.header("Welcome Setup", "Let's secure your digital life!");
	
	// Welcome message
	console.log(colors.brand("╔" + "═".repeat(48) + "╗"));
	console.log(
		colors.brand("║") +
		colors.success_bold("   ✨ Welcome to Password Manager! ✨     ") +
		colors.brand("║"),
	);
	console.log(colors.brand("╚" + "═".repeat(48) + "╝"));

	ui.space();
	ui.divider();
	console.log(colors.highlight("Setting up your secure password vault"));
	ui.space();

	// Security warnings
	console.log(colors.warning("🔐 Security Information:"));
	console.log(colors.muted("   • Your master code is never stored anywhere"));
	console.log(colors.muted("   • All passwords are encrypted with AES-256"));
	console.log(colors.muted("   • If you forget your master code, data cannot be recovered"));
	ui.space();
	await delay(2000);

	// Step 1: Get user name
	console.log(colors.secondary("👤 Step 1: Your Name"));
	const username = await y.input({
		message: colors.primary("Enter your name:"),
		validate: (value: string) => {
			const trimmed = value.trim();
			if (!trimmed) return "Name cannot be empty";
			if (trimmed.length < 2) return "Name must be at least 2 characters";
			if (trimmed.length > 50) return "Name must be less than 50 characters";
			if (/^\d+$/.test(trimmed)) return "Name cannot be only numbers";
			return true;
		},
	});

	console.log(colors.success(`✅ Hello, ${colors.highlight(username)}!`));
	ui.space();
	await delay(500);

	// Step 2: Set master code with confirmation
	let mastercode: string = "";
	let confirmed = false;

	do {
		console.log(colors.secondary("🔑 Step 2: Master Code"));
		console.log(colors.muted("   This code protects all your passwords (minimum 6 characters)"));
		
		mastercode = await y.password({
			message: colors.primary("Create master code:"),
			validate: (value: string) => {
				if (value.length < 6) return "Master code must be at least 6 characters";
				if (value.length > 128) return "Master code must be less than 128 characters";
				if (value.trim() !== value) return "Master code cannot start or end with spaces";
				return true;
			},
		});

		// Show strength indicator
		const strength = utils.analyzePasswordStrength(mastercode);
		const strengthColors = {
			"very-weak": colors.danger,
			"weak": colors.warning,
			"fair": colors.warning,
			"good": colors.success,
			"strong": colors.success_bold,
		};
		
		console.log(`   Strength: ${strengthColors[strength.level](strength.level.toUpperCase())}`);
		if (strength.feedback.length > 0) {
			console.log(colors.muted("   Suggestions: " + strength.feedback.join(", ")));
		}
		ui.space();

		// Confirm master code
		const confirmCode = await y.password({
			message: colors.primary("Confirm master code:"),
		});

		if (mastercode === confirmCode) {
			confirmed = true;
			console.log(colors.success("✅ Master codes match!"));
		} else {
			console.log(colors.warning("❌ Master codes don't match. Please try again."));
			ui.space();
			await delay(1000);
		}
	} while (!confirmed);

	ui.space();
	
	// Create user data
	const userData: UserData = {
		name: username.trim(),
		mastercode,
		createdAt: utils.timestamp(),
		settings: {
			theme: "default",
			confirmDeletions: true,
			showPasswordStrength: true,
		},
	};

	// Save to database
	spinner.start("Creating your secure vault...");
	await delay(1500);
	
	try {
		await db.write("users", "creds", userData);
		spinner.succeed("Vault created successfully!");
	} catch (error) {
		spinner.fail("Failed to create vault");
		await errorHandler.handle(error as Error, "vault creation");
		throw error;
	}

	ui.space();
	
	// Summary
	console.log(colors.highlight("🎉 Setup Complete!"));
	ui.divider("─", 30, colors.muted);
	console.log(`   Name: ${colors.primary(userData.name)}`);
	console.log(`   Created: ${colors.muted(utils.formatDate(userData.createdAt))}`);
	console.log(`   Security: ${colors.success("AES-256 Encryption")}`);
	ui.divider("─", 30, colors.muted);
	ui.space();
	
	await delay(2000);
	return userData;
}

async function authenticateUser(userData: UserData): Promise<boolean> {
	ui.header("Authentication", `Welcome back, ${userData.name}!`);
	
	console.log(colors.muted(`Last login: ${userData.lastLogin ? utils.formatDate(userData.lastLogin) : "First time"}`));
	ui.space();

	let attempts = 0;
	const maxAttempts = 3;

	while (attempts < maxAttempts) {
		const mastercode = await y.password({
			message: colors.primary("Enter your master code:"),
		});

		if (mastercode === userData.mastercode) {
			// Update last login
			userData.lastLogin = utils.timestamp();
			await db.write("users", "creds", userData);
			
			console.log(colors.success("✅ Authentication successful!"));
			await delay(500);
			return true;
		}

		attempts++;
		const remaining = maxAttempts - attempts;
		
		if (remaining > 0) {
			console.log(colors.warning(`❌ Incorrect master code. ${remaining} attempt${remaining > 1 ? 's' : ''} remaining.`));
			await delay(1000);
		} else {
			console.log(colors.error("❌ Too many failed attempts. Exiting for security."));
			await delay(2000);
			return false;
		}
	}

	return false;
}

async function onboarding() {
	console.clear();
	
	// Show app header
	ui.header(APP_NAME, `Version ${APP_VERSION}`);

	// Initialize spinner
	globalThis.spinner = ora({
		text: "Initializing secure environment...",
		spinner: "dots12",
		color: "cyan",
	}).start();

	try {
		// Initialize database
		const existingData = await initializeDatabase();
		
		// Check for updates
		await checkForUpdates();
		
		spinner.stop();

		let userData: UserData;

		if (!existingData) {
			// New user setup
			userData = await setupNewUser();
		} else {
			// Existing user authentication
			userData = existingData;
			const authenticated = await authenticateUser(userData);
			
			if (!authenticated) {
				console.log(colors.error("Authentication failed. Goodbye!"));
				process.exit(1);
			}
		}

		// Initialize encryptor
		globalThis.enc = new Encryptor(userData.mastercode, {
			iterations: 25_000,
		});

		// Store user data globally for access throughout the app
		globalThis.userData = userData;

		// Clear screen and show loading
		console.clear();
		spinner.start("Loading password vault...");
		await delay(1000);
		spinner.stop();

		// Launch main menu
		await mainmenu();

	} catch (error) {
		spinner.fail("Initialization failed");
		await errorHandler.handle(error as Error, "application startup");
		process.exit(1);
	}
}

// Start the application
setupGlobalSignalHandlers();
onboarding();
