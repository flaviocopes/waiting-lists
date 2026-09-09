export const API_SCOPES = [
	'lists:read',
	'lists:write',
	'subscribers:export',
] as const;

export type ApiScope = (typeof API_SCOPES)[number];

export type ApiKeyRecord = {
	id: string;
	name: string;
	token_prefix: string;
	scopes: string;
	created_at: string;
	last_used_at: string | null;
	revoked_at: string | null;
};

export type AuthenticatedApiKey = ApiKeyRecord & { parsedScopes: ApiScope[] };

const TOKEN_PREFIX = 'wl_live_';
const TOKEN_BYTES = 32;
const MAX_TOKEN_LENGTH = 100;

function toHex(bytes: ArrayBuffer): string {
	return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function randomToken(byteLength = TOKEN_BYTES): string {
	const bytes = new Uint8Array(byteLength);
	crypto.getRandomValues(bytes);
	return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

export async function hashApiToken(token: string): Promise<string> {
	return toHex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token)));
}

export function createApiToken(): string {
	return `${TOKEN_PREFIX}${randomToken()}`;
}

export function apiTokenPrefix(token: string): string {
	return `${token.slice(0, TOKEN_PREFIX.length + 6)}…${token.slice(-4)}`;
}

export function parseBearerToken(header: string | null): string | null {
	if (!header?.startsWith('Bearer ')) return null;
	const token = header.slice('Bearer '.length);
	if (!token.startsWith(TOKEN_PREFIX) || token.length > MAX_TOKEN_LENGTH || /\s/.test(token)) return null;
	return token;
}

export function parseApiScopes(value: string): ApiScope[] {
	const parsed = value.split(' ').filter((scope): scope is ApiScope =>
		API_SCOPES.includes(scope as ApiScope),
	);
	return [...new Set(parsed)];
}

export async function createApiKey(db: D1Database, name: string) {
	const token = createApiToken();
	const record = {
		id: crypto.randomUUID(),
		name,
		tokenPrefix: apiTokenPrefix(token),
		scopes: API_SCOPES.join(' '),
	};
	await db
		.prepare('INSERT INTO api_keys (id, name, token_hash, token_prefix, scopes) VALUES (?, ?, ?, ?, ?)')
		.bind(record.id, record.name, await hashApiToken(token), record.tokenPrefix, record.scopes)
		.run();
	return { token, ...record };
}

export async function getApiKeys(db: D1Database) {
	const result = await db
		.prepare(`
			SELECT id, name, token_prefix, scopes, created_at, last_used_at, revoked_at
			FROM api_keys
			ORDER BY created_at DESC
		`)
		.all<ApiKeyRecord>();
	return result.results;
}

export async function revokeApiKey(db: D1Database, id: string) {
	const result = await db
		.prepare('UPDATE api_keys SET revoked_at = CURRENT_TIMESTAMP WHERE id = ? AND revoked_at IS NULL')
		.bind(id)
		.run();
	return result.meta.changes === 1;
}

export async function authenticateApiKey(
	db: D1Database,
	request: Request,
	requiredScope: ApiScope,
): Promise<AuthenticatedApiKey | null> {
	const token = parseBearerToken(request.headers.get('authorization'));
	if (!token) return null;

	const record = await db
		.prepare(`
			SELECT id, name, token_prefix, scopes, created_at, last_used_at, revoked_at
			FROM api_keys
			WHERE token_hash = ? AND revoked_at IS NULL
		`)
		.bind(await hashApiToken(token))
		.first<ApiKeyRecord>();
	if (!record) return null;

	const parsedScopes = parseApiScopes(record.scopes);
	if (!parsedScopes.includes(requiredScope)) return null;

	await db
		.prepare('UPDATE api_keys SET last_used_at = CURRENT_TIMESTAMP WHERE id = ?')
		.bind(record.id)
		.run();
	return { ...record, parsedScopes };
}
