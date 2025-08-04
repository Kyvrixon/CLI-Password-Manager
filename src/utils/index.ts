import { 
	blue, 
	green, 
	yellow, 
	red, 
	cyan, 
	gray, 
	bold, 
	dim,
	magenta 
} from "colorette";
import crypto from "crypto";

export const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Enhanced color utilities with consistent theming
export const colors = {
	primary: cyan,
	secondary: blue,
	success: green,
	warning: yellow,
	danger: red,
	info: magenta,
	muted: gray,
	text: (str: string) => str,
	bold,
	dim,
	
	// Semantic colors
	brand: (str: string) => bold(cyan(str)),
	highlight: (str: string) => bold(blue(str)),
	success_bold: (str: string) => bold(green(str)),
	warning_bold: (str: string) => bold(yellow(str)),
	error: (str: string) => bold(red(str)),
	subtle: dim,
};

// UI Components
export const ui = {
	// Box drawing characters for consistent UI
	box: {
		topLeft: "╭",
		topRight: "╮",
		bottomLeft: "╰",
		bottomRight: "╯",
		horizontal: "─",
		vertical: "│",
		cross: "┼",
		teeUp: "┴",
		teeDown: "┬",
		teeLeft: "┤",
		teeRight: "├",
	},

	// Create bordered sections
	section: (title: string, width: number = 50) => {
		const padding = Math.max(0, width - title.length - 4);
		const leftPad = Math.floor(padding / 2);
		const rightPad = padding - leftPad;
		
		console.log(colors.primary(
			ui.box.topLeft + 
			ui.box.horizontal.repeat(leftPad + 1) + 
			" " + title + " " + 
			ui.box.horizontal.repeat(rightPad + 1) + 
			ui.box.topRight
		));
	},

	// Dividers
	divider: (char: string = "─", length: number = 50, color = colors.muted) => {
		console.log(color(char.repeat(length)));
	},

	// Spacers
	space: (lines: number = 1) => {
		console.log("\n".repeat(lines - 1));
	},

	// Status indicators
	status: {
		success: (msg: string) => console.log(colors.success("✅ " + msg)),
		warning: (msg: string) => console.log(colors.warning("⚠️  " + msg)),
		error: (msg: string) => console.log(colors.error("❌ " + msg)),
		info: (msg: string) => console.log(colors.info("ℹ️  " + msg)),
		loading: (msg: string) => console.log(colors.primary("⏳ " + msg)),
	},

	// Headers
	header: (title: string, subtitle?: string) => {
		console.clear();
		ui.section(title);
		if (subtitle) {
			console.log(colors.muted("   " + subtitle));
		}
		ui.space();
	},

	// Password display with masking
	passwordDisplay: (password: string, masked: boolean = true) => {
		if (masked) {
			return colors.muted("•".repeat(Math.min(password.length, 12)));
		}
		return colors.highlight(password);
	},
};

// Utility functions
export const utils = {
	// Generate unique ID
	generateId: (): string => {
		return crypto.randomBytes(8).toString("hex");
	},

	// Get current timestamp
	timestamp: (): string => {
		return new Date().toISOString();
	},

	// Format date for display
	formatDate: (dateString: string): string => {
		const date = new Date(dateString);
		return date.toLocaleDateString() + " " + date.toLocaleTimeString([], { 
			hour: '2-digit', 
			minute: '2-digit' 
		});
	},

	// Generate secure password
	generatePassword: (length: number = 16, options: {
		includeUppercase?: boolean;
		includeLowercase?: boolean;
		includeNumbers?: boolean;
		includeSymbols?: boolean;
		excludeSimilar?: boolean;
	} = {}): string => {
		const {
			includeUppercase = true,
			includeLowercase = true,
			includeNumbers = true,
			includeSymbols = true,
			excludeSimilar = true,
		} = options;

		let charset = "";
		
		if (includeUppercase) {
			charset += excludeSimilar ? "ABCDEFGHJKLMNPQRSTUVWXYZ" : "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
		}
		if (includeLowercase) {
			charset += excludeSimilar ? "abcdefghjkmnpqrstuvwxyz" : "abcdefghijklmnopqrstuvwxyz";
		}
		if (includeNumbers) {
			charset += excludeSimilar ? "23456789" : "0123456789";
		}
		if (includeSymbols) {
			charset += "!@#$%^&*()_+-=[]{}|;:,.<>?";
		}

		if (!charset) {
			throw new Error("At least one character set must be included");
		}

		let password = "";
		for (let i = 0; i < length; i++) {
			const randomIndex = crypto.randomInt(0, charset.length);
			password += charset[randomIndex];
		}

		return password;
	},

	// Analyze password strength
	analyzePasswordStrength: (password: string): PasswordStrength => {
		const length = password.length;
		const hasUppercase = /[A-Z]/.test(password);
		const hasLowercase = /[a-z]/.test(password);
		const hasNumbers = /\d/.test(password);
		const hasSymbols = /[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(password);
		
		let score = 0;
		const feedback: string[] = [];

		// Length scoring
		if (length >= 12) score += 2;
		else if (length >= 8) score += 1;
		else feedback.push("Use at least 8 characters");

		// Character variety scoring
		if (hasUppercase) score += 1;
		else feedback.push("Add uppercase letters");
		
		if (hasLowercase) score += 1;
		else feedback.push("Add lowercase letters");
		
		if (hasNumbers) score += 1;
		else feedback.push("Add numbers");
		
		if (hasSymbols) score += 1;
		else feedback.push("Add symbols");

		// Pattern penalties
		if (/(.)\1{2,}/.test(password)) {
			score -= 1;
			feedback.push("Avoid repeated characters");
		}
		
		if (/123|abc|qwe/i.test(password)) {
			score -= 1;
			feedback.push("Avoid common sequences");
		}

		// Determine level
		let level: PasswordStrength["level"];
		if (score <= 1) level = "very-weak";
		else if (score <= 2) level = "weak";
		else if (score <= 4) level = "fair";
		else if (score <= 6) level = "good";
		else level = "strong";

		return {
			score: Math.max(0, Math.min(4, score)),
			level,
			feedback,
			hasUppercase,
			hasLowercase,
			hasNumbers,
			hasSymbols,
			length,
		};
	},

	// Validate email format
	isValidEmail: (email: string): boolean => {
		return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
	},

	// Validate URL format
	isValidUrl: (url: string): boolean => {
		try {
			new URL(url);
			return true;
		} catch {
			return false;
		}
	},

	// Truncate text with ellipsis
	truncate: (text: string, maxLength: number): string => {
		if (text.length <= maxLength) return text;
		return text.slice(0, maxLength - 3) + "...";
	},

	// Calculate vault statistics
	calculateVaultStats: (passwords: PasswordData): VaultStats => {
		const categories = [...new Set(passwords.map(p => p.category).filter((cat): cat is string => Boolean(cat)))];
		
		let strongPasswords = 0;
		let weakPasswords = 0;
		const passwordValues = new Set<string>();
		let duplicatePasswords = 0;

		passwords.forEach(password => {
			// Note: We can't analyze encrypted passwords directly
			// This would need to be done when passwords are decrypted
			if (passwordValues.has(password.value)) {
				duplicatePasswords++;
			} else {
				passwordValues.add(password.value);
			}
		});

		return {
			totalPasswords: passwords.length,
			categories,
			strongPasswords,
			weakPasswords,
			duplicatePasswords,
		};
	},
};

// Error handling utilities
export const errorHandler = {
	// Graceful error handling with user-friendly messages
	handle: async (error: Error, context: string = "operation") => {
		console.error(colors.error(`\n❌ Error during ${context}:`));
		
		if (error.message.includes("ENOENT")) {
			console.error(colors.muted("   File or directory not found"));
		} else if (error.message.includes("EACCES")) {
			console.error(colors.muted("   Permission denied"));
		} else if (error.message.includes("Network")) {
			console.error(colors.muted("   Network connection issue"));
		} else {
			console.error(colors.muted(`   ${error.message}`));
		}
		
		ui.space();
		await delay(2000);
	},

	// Validation error
	validation: (message: string) => {
		return colors.warning("⚠️  " + message);
	},
};

export default {
	delay,
	colors,
	ui,
	utils,
	errorHandler,
};
