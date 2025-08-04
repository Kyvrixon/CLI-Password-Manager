import type Encryptor from "@kyvrixon/encryptor";
import type Database from "@kyvrixon/json-db";
import { type Ora } from "ora";

declare global {
	var spinner: Ora;
	var enc: Encryptor;
	var db: Database;
	var userData: UserData;

	type UserData = {
		name: string;
		mastercode: string;
		createdAt: string;
		lastLogin?: string;
		settings?: UserSettings;
	};

	type UserSettings = {
		theme: "default" | "minimal" | "colorful";
		confirmDeletions: boolean;
		showPasswordStrength: boolean;
	};

	type Password = {
		id: string;
		nickname: string;
		value: string; // encrypted
		description: string;
		url?: string;
		username?: string;
		createdAt: string;
		updatedAt: string;
		category?: string;
		tags?: string[];
		favorite?: boolean;
	};

	type PasswordData = Array<Password>;

	type VaultStats = {
		totalPasswords: number;
		categories: string[];
		lastBackup?: string;
		strongPasswords: number;
		weakPasswords: number;
		duplicatePasswords: number;
	};

	type ExportData = {
		version: string;
		exportDate: string;
		userData: Omit<UserData, "mastercode">;
		passwords: PasswordData;
		checksum: string;
	};

	type PasswordStrength = {
		score: number; // 0-4
		level: "very-weak" | "weak" | "fair" | "good" | "strong";
		feedback: string[];
		hasUppercase: boolean;
		hasLowercase: boolean;
		hasNumbers: boolean;
		hasSymbols: boolean;
		length: number;
	};
}

export {};
