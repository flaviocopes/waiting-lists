import { authenticateApiKey, type ApiScope } from './api-keys';

const JSON_HEADERS = {
	'Cache-Control': 'no-store',
	'Content-Type': 'application/json; charset=utf-8',
};

export function jsonResponse(data: unknown, init: ResponseInit = {}): Response {
	const headers = new Headers(init.headers);
	for (const [name, value] of Object.entries(JSON_HEADERS)) headers.set(name, value);
	return Response.json(data, { ...init, headers });
}

export function apiError(status: number, code: string, message: string): Response {
	const headers = status === 401 ? { 'WWW-Authenticate': 'Bearer realm="waitinglists.dev"' } : undefined;
	return jsonResponse({ error: { code, message } }, { status, headers });
}

export async function requireApiKey(db: D1Database, request: Request, scope: ApiScope) {
	const key = await authenticateApiKey(db, request, scope);
	return key ?? apiError(401, 'unauthorized', 'A valid API key with the required scope is required.');
}

export async function readJsonObject(request: Request, maxBytes = 16_384): Promise<Record<string, unknown> | null> {
	if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return null;
	const declaredLength = Number(request.headers.get('content-length') ?? 0);
	if (declaredLength > maxBytes) return null;
	if (!request.body) return null;

	try {
		const reader = request.body.getReader();
		const decoder = new TextDecoder();
		let received = 0;
		let text = '';
		while (true) {
			const chunk = await reader.read();
			if (chunk.done) break;
			received += chunk.value.byteLength;
			if (received > maxBytes) {
				await reader.cancel();
				return null;
			}
			text += decoder.decode(chunk.value, { stream: true });
		}
		text += decoder.decode();
		const value: unknown = JSON.parse(text);
		if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
		return value as Record<string, unknown>;
	} catch {
		return null;
	}
}
