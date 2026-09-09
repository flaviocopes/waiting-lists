type SiteverifyResult = {
	success: boolean;
	action: string;
	hostname: string;
};

type VerifyTurnstileInput = {
	token: unknown;
	secret: string;
	expectedAction: string;
	allowedHostnames: string;
	remoteIp?: string;
	fetcher?: typeof fetch;
};

function isSiteverifyResult(value: unknown): value is SiteverifyResult {
	return (
		typeof value === 'object' &&
		value !== null &&
		'success' in value &&
		typeof value.success === 'boolean' &&
		'action' in value &&
		typeof value.action === 'string' &&
		'hostname' in value &&
		typeof value.hostname === 'string'
	);
}

export async function verifyTurnstile(input: VerifyTurnstileInput): Promise<boolean> {
	if (typeof input.token !== 'string' || input.token.length === 0 || input.token.length > 2048) return false;
	if (!input.secret) return false;

	const hostnames = new Set(
		input.allowedHostnames
			.split(',')
			.map((hostname) => hostname.trim().toLowerCase())
			.filter(Boolean),
	);
	if (hostnames.size === 0) return false;

	const body = new URLSearchParams({
		secret: input.secret,
		response: input.token,
	});
	if (input.remoteIp) body.set('remoteip', input.remoteIp);

	try {
		const response = await (input.fetcher ?? fetch)('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body,
			signal: AbortSignal.timeout(10_000),
		});
		if (!response.ok) return false;

		const result: unknown = await response.json();
		if (!isSiteverifyResult(result)) return false;
		return (
			result.success === true &&
			result.action === input.expectedAction &&
			hostnames.has(result.hostname.toLowerCase())
		);
	} catch {
		return false;
	}
}
