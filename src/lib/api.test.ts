import { describe, expect, it } from 'vitest';
import { readJsonObject } from './api';

describe('API JSON bodies', () => {
	it('reads a bounded JSON object', async () => {
		const request = new Request('https://waiting-lists.example/api/v1/lists', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ name: 'Product' }),
		});
		expect(await readJsonObject(request)).toEqual({ name: 'Product' });
	});

	it('rejects oversized streaming bodies even without content-length', async () => {
		const request = new Request('https://waiting-lists.example/api/v1/lists', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ name: 'x'.repeat(100) }),
		});
		expect(await readJsonObject(request, 32)).toBeNull();
	});

	it('rejects arrays and non-JSON content types', async () => {
		const arrayRequest = new Request('https://waiting-lists.example/api/v1/lists', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: '[]',
		});
		const textRequest = new Request('https://waiting-lists.example/api/v1/lists', {
			method: 'POST',
			headers: { 'Content-Type': 'text/plain' },
			body: '{}',
		});
		expect(await readJsonObject(arrayRequest)).toBeNull();
		expect(await readJsonObject(textRequest)).toBeNull();
	});
});
