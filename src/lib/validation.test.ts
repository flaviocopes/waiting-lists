import { describe, expect, it } from 'vitest';
import {
	csvCell,
	parseAdminPassword,
	parseAdminUsername,
	parseApiKeyName,
	parseEmail,
	parseWaitingListDetails,
} from './validation';

describe('email-only validation', () => {
	it('normalizes a valid email', () => {
		expect(parseEmail('  Person@Example.COM ')).toBe('person@example.com');
	});

	it('rejects invalid or oversized email values', () => {
		expect(parseEmail('not-an-email')).toBeNull();
		expect(parseEmail(`${'a'.repeat(250)}@example.com`)).toBeNull();
	});
});

describe('API key name validation', () => {
	it('normalizes useful labels and rejects empty ones', () => {
		expect(parseApiKeyName('  Local Codex  ')).toBe('Local Codex');
		expect(parseApiKeyName(' ')).toBeNull();
	});
});

describe('admin credential validation', () => {
	it('accepts a simple username and a long password', () => {
		expect(parseAdminUsername('  admin  ')).toBe('admin');
		expect(parseAdminPassword('a secure passphrase')).toBe('a secure passphrase');
	});

	it('rejects unsafe usernames and short passwords', () => {
		expect(parseAdminUsername('admin user')).toBeNull();
		expect(parseAdminPassword('too-short')).toBeNull();
	});
});

describe('waiting list validation', () => {
	it('accepts a list with explicit origins', () => {
		expect(
			parseWaitingListDetails({
				name: 'Product launch',
				slug: 'product-launch',
				allowed_origins: 'https://example.com, https://www.example.com',
			}),
		).toEqual({
			name: 'Product launch',
			slug: 'product-launch',
			allowedOrigins: 'https://example.com, https://www.example.com',
		});
	});

	it('rejects unsafe slugs and malformed origins', () => {
		expect(parseWaitingListDetails({ name: 'Product', slug: '../product', allowed_origins: '*' })).toBeNull();
		expect(parseWaitingListDetails({ name: 'Product', slug: 'product', allowed_origins: 'example.com' })).toBeNull();
	});
});

it('escapes CSV cells', () => {
	expect(csvCell('a"b')).toBe('"a""b"');
});
