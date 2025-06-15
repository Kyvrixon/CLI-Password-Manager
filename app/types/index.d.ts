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
	};

	type Password = {
		nickname: string;
		value: string;
		description: string;
	};

	type PasswordData = Array<Password>;
}

export {};
