/// <reference path="../worker-configuration.d.ts" />

declare namespace App {
	interface Locals {
		cfContext: ExecutionContext;
		csrfToken?: string;
	}
}

declare namespace Cloudflare {
	interface Env {
		SUBSCRIBER_TOKEN_SECRET?: string;
		TURNSTILE_SECRET: string;
	}
}

interface Env {
	SUBSCRIBER_TOKEN_SECRET?: string;
	TURNSTILE_SECRET: string;
}

declare module '@alpinejs/csp' {
	type AlpineData = Record<string, unknown>;
	interface AlpineCsp {
		data(name: string, callback: () => AlpineData): void;
		start(): void;
	}
	const Alpine: AlpineCsp;
	export default Alpine;
}
