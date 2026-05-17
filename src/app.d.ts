declare global {
	namespace App {
		interface Locals {
			token: string | undefined;
			userId: number | undefined;
			userName: string | undefined;
		}
	}
}

export {};
