import type { AppBindings } from './runtime';

const COOKIE_NAME = '__Host-waitinglists_session';
const SESSION_TTL_SECONDS = 12 * 60 * 60;
const PASSWORD_HASH_ALGORITHM = 'pbkdf2-sha256';
const PASSWORD_HASH_ITERATIONS = 120_000;

type SessionRow = { csrf_token: string; expires_at: number };
type RequestLike = {
	headers: Headers;
	url: string;
	formData(): Promise<FormData>;
};

function toHex(bytes: ArrayBuffer): string {
	return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function sha256(value: string): Promise<ArrayBuffer> {
	return crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
}

async function sha256Hex(value: string): Promise<string> {
	return toHex(await sha256(value));
}

function randomBytes(byteLength: number): Uint8Array {
	const bytes = new Uint8Array(byteLength);
	crypto.getRandomValues(bytes);
	return bytes;
}

function bytesToBase64Url(bytes: Uint8Array): string {
	return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function base64UrlToBytes(value: string): Uint8Array | null {
	try {
		const normalized = value.replaceAll('-', '+').replaceAll('_', '/');
		const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
		return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
	} catch {
		return null;
	}
}

async function derivePasswordHash(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
	const key = await crypto.subtle.importKey(
		'raw',
		new TextEncoder().encode(password),
		'PBKDF2',
		false,
		['deriveBits'],
	);
	const bits = await crypto.subtle.deriveBits(
		{ name: 'PBKDF2', hash: 'SHA-256', salt: new Uint8Array(salt).buffer, iterations },
		key,
		256,
	);
	return new Uint8Array(bits);
}

async function sessionTokenHash(secret: string, token: string): Promise<string> {
	const key = await crypto.subtle.importKey(
		'raw',
		new TextEncoder().encode(secret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign'],
	);
	return toHex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(token)));
}

async function constantTimeTextEqual(left: string, right: string): Promise<boolean> {
	const [leftHash, rightHash] = await Promise.all([sha256(left), sha256(right)]);
	const leftBytes = new Uint8Array(leftHash);
	const rightBytes = new Uint8Array(rightHash);
	let difference = 0;
	for (let index = 0; index < leftBytes.length; index += 1) {
		difference |= leftBytes[index] ^ rightBytes[index];
	}
	return difference === 0;
}

function constantTimeBytesEqual(left: Uint8Array, right: Uint8Array): boolean {
	let difference = left.byteLength ^ right.byteLength;
	const length = Math.max(left.byteLength, right.byteLength);
	for (let index = 0; index < length; index += 1) {
		difference |= (left[index] ?? 0) ^ (right[index] ?? 0);
	}
	return difference === 0;
}

export async function hashAdminPassword(password: string): Promise<string> {
	const salt = randomBytes(16);
	const digest = await derivePasswordHash(password, salt, PASSWORD_HASH_ITERATIONS);
	return [
		PASSWORD_HASH_ALGORITHM,
		String(PASSWORD_HASH_ITERATIONS),
		bytesToBase64Url(salt),
		bytesToBase64Url(digest),
	].join('$');
}

export async function verifyAdminPassword(password: string, storedHash: string): Promise<boolean> {
	const [algorithm, iterationsText, saltText, digestText, ...extra] = storedHash.split('$');
	const iterations = Number.parseInt(iterationsText ?? '', 10);
	const salt = base64UrlToBytes(saltText ?? '');
	const expectedDigest = base64UrlToBytes(digestText ?? '');
	if (
		algorithm !== PASSWORD_HASH_ALGORITHM ||
		extra.length > 0 ||
		!Number.isInteger(iterations) ||
		iterations < 100_000 ||
		iterations > 1_000_000 ||
		!salt ||
		salt.byteLength < 16 ||
		!expectedDigest ||
		expectedDigest.byteLength !== 32
	) {
		return false;
	}
	const actualDigest = await derivePasswordHash(password, salt, iterations);
	return constantTimeBytesEqual(actualDigest, expectedDigest);
}

function randomToken(byteLength = 32): string {
	const bytes = new Uint8Array(byteLength);
	crypto.getRandomValues(bytes);
	return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function cookieValue(request: RequestLike, name: string): string | null {
	const cookie = request.headers.get('cookie') ?? '';
	for (const part of cookie.split(';')) {
		const [key, ...rest] = part.trim().split('=');
		if (key === name) return rest.join('=');
	}
	return null;
}

export async function verifyAdminCredentials(
	bindings: AppBindings,
	username: string,
	password: string,
): Promise<boolean> {
	const settings = await bindings.DB
		.prepare('SELECT admin_username, admin_password_hash FROM global_settings WHERE id = 1')
		.first<{ admin_username: string; admin_password_hash: string | null }>();
	const expectedUsername = settings?.admin_username ?? bindings.ADMIN_USERNAME;
	const [usernameMatches, passwordMatches] = await Promise.all([
		constantTimeTextEqual(username, expectedUsername),
		settings?.admin_password_hash
			? verifyAdminPassword(password, settings.admin_password_hash)
			: sha256Hex(password).then((digest) => constantTimeTextEqual(digest, bindings.ADMIN_PASSWORD_HASH)),
	]);
	return usernameMatches && passwordMatches;
}

export async function createSession(db: D1Database, secret: string) {
	const token = randomToken();
	const csrfToken = randomToken(24);
	const now = Math.floor(Date.now() / 1000);
	const expiresAt = now + SESSION_TTL_SECONDS;
	await db.batch([
		db.prepare('DELETE FROM admin_sessions WHERE expires_at <= ?').bind(now),
		db
			.prepare('INSERT INTO admin_sessions (token_hash, csrf_token, expires_at, created_at) VALUES (?, ?, ?, ?)')
			.bind(await sessionTokenHash(secret, token), csrfToken, expiresAt, now),
	]);
	return {
		cookie: `${COOKIE_NAME}=${token}; Path=/; Max-Age=${SESSION_TTL_SECONDS}; HttpOnly; Secure; SameSite=Strict`,
	};
}

export async function getSession(db: D1Database, request: RequestLike, secret: string) {
	const token = cookieValue(request, COOKIE_NAME);
	if (!token || token.length > 100) return null;
	const row = await db
		.prepare('SELECT csrf_token, expires_at FROM admin_sessions WHERE token_hash = ? AND expires_at > ?')
		.bind(await sessionTokenHash(secret, token), Math.floor(Date.now() / 1000))
		.first<SessionRow>();
	return row ? { csrfToken: row.csrf_token, expiresAt: row.expires_at } : null;
}

export async function destroySession(db: D1Database, request: RequestLike, secret: string) {
	const token = cookieValue(request, COOKIE_NAME);
	if (token) {
		await db.prepare('DELETE FROM admin_sessions WHERE token_hash = ?').bind(await sessionTokenHash(secret, token)).run();
	}
	return `${COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`;
}

export async function verifyCsrf(request: RequestLike, expectedToken: string): Promise<boolean> {
	const origin = request.headers.get('origin');
	if (origin && origin !== new URL(request.url).origin) return false;
	const form = await request.formData();
	const provided = form.get('csrf');
	return typeof provided === 'string' && constantTimeTextEqual(provided, expectedToken);
}
