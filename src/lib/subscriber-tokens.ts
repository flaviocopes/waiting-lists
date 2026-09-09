const encoder = new TextEncoder();

function toHex(bytes: ArrayBuffer): string {
	return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function hmacHex(secret: string, value: string): Promise<string> {
	const key = await crypto.subtle.importKey(
		'raw',
		encoder.encode(secret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign'],
	);
	return toHex(await crypto.subtle.sign('HMAC', key, encoder.encode(value)));
}

function constantTimeEqual(left: string, right: string): boolean {
	if (left.length !== right.length) return false;
	let difference = 0;
	for (let index = 0; index < left.length; index += 1) {
		difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
	}
	return difference === 0;
}

export function createConfirmationToken(): string {
	const bytes = new Uint8Array(32);
	crypto.getRandomValues(bytes);
	return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

export function validConfirmationToken(token: string): boolean {
	return /^[A-Za-z0-9_-]{43}$/.test(token);
}

export function confirmationTokenCandidates(...values: unknown[]): string[] {
	const candidates: string[] = [];
	for (const value of values) {
		if (typeof value === 'string' && validConfirmationToken(value) && !candidates.includes(value)) {
			candidates.push(value);
		}
	}
	return candidates;
}

export async function hashConfirmationToken(secret: string, token: string): Promise<string> {
	return hmacHex(secret, `confirm:${token}`);
}

export async function signRemoval(secret: string, subscriberId: string): Promise<string> {
	return hmacHex(secret, `remove:${subscriberId}`);
}

export async function verifyRemoval(secret: string, subscriberId: string, signature: string): Promise<boolean> {
	if (!/^[0-9a-f]{64}$/.test(signature)) return false;
	return constantTimeEqual(await signRemoval(secret, subscriberId), signature);
}
