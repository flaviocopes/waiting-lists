import { describe, expect, it } from 'vitest';
import { hashAdminPassword, verifyAdminPassword } from './auth';

describe('database-backed admin passwords', () => {
	it('stores a salted password hash and verifies the matching password', async () => {
		const firstHash = await hashAdminPassword('correct horse battery staple');
		const secondHash = await hashAdminPassword('correct horse battery staple');

		expect(firstHash).toMatch(/^pbkdf2-sha256\$120000\$/);
		expect(firstHash).not.toBe(secondHash);
		expect(await verifyAdminPassword('correct horse battery staple', firstHash)).toBe(true);
		expect(await verifyAdminPassword('wrong password', firstHash)).toBe(false);
	});

	it('rejects malformed or deliberately expensive stored hashes', async () => {
		expect(await verifyAdminPassword('password', 'not-a-valid-hash')).toBe(false);
		expect(await verifyAdminPassword('password', 'pbkdf2-sha256$9999999$c2FsdA$ZGlnZXN0')).toBe(false);
	});
});
