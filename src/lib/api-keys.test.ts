import { describe, expect, it } from 'vitest';
import { apiTokenPrefix, createApiToken, hashApiToken, parseApiScopes, parseBearerToken } from './api-keys';

describe('API keys', () => {
	it('creates prefixed, high-entropy tokens and safe display prefixes', () => {
		const token = createApiToken();
		expect(token).toMatch(/^wl_live_[A-Za-z0-9_-]{43}$/);
		expect(apiTokenPrefix(token)).toMatch(/^wl_live_.{6}….{4}$/);
	});

	it('hashes tokens consistently without storing the original value', async () => {
		const token = 'wl_live_example';
		const digest = await hashApiToken(token);
		expect(digest).toHaveLength(64);
		expect(digest).toBe(await hashApiToken(token));
		expect(digest).not.toContain(token);
	});

	it('only accepts well-formed bearer credentials', () => {
		expect(parseBearerToken('Bearer wl_live_abc123')).toBe('wl_live_abc123');
		expect(parseBearerToken('Basic wl_live_abc123')).toBeNull();
		expect(parseBearerToken('Bearer other_abc123')).toBeNull();
		expect(parseBearerToken('Bearer wl_live_has spaces')).toBeNull();
	});

	it('ignores unknown scopes and removes duplicates', () => {
		expect(parseApiScopes('lists:read unknown lists:read subscribers:export')).toEqual([
			'lists:read',
			'subscribers:export',
		]);
	});
});
