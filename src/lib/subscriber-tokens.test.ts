import { describe, expect, it } from 'vitest';
import {
	confirmationTokenCandidates,
	createConfirmationToken,
	hashConfirmationToken,
	signRemoval,
	validConfirmationToken,
	verifyRemoval,
} from './subscriber-tokens';

describe('subscriber tokens', () => {
	it('creates URL-safe 256-bit confirmation tokens', () => {
		const token = createConfirmationToken();
		expect(token).toHaveLength(43);
		expect(validConfirmationToken(token)).toBe(true);
	});

	it('hashes the same token consistently and binds it to the secret', async () => {
		const token = createConfirmationToken();
		const first = await hashConfirmationToken('a-secure-test-secret', token);
		const second = await hashConfirmationToken('a-secure-test-secret', token);
		const otherSecret = await hashConfirmationToken('another-secure-test-secret', token);
		expect(first).toBe(second);
		expect(first).not.toBe(otherSecret);
		expect(first).toMatch(/^[0-9a-f]{64}$/);
	});

	it('accepts only the matching removal signature', async () => {
		const subscriberId = crypto.randomUUID();
		const signature = await signRemoval('a-secure-test-secret', subscriberId);
		expect(await verifyRemoval('a-secure-test-secret', subscriberId, signature)).toBe(true);
		expect(await verifyRemoval('a-secure-test-secret', crypto.randomUUID(), signature)).toBe(false);
		expect(await verifyRemoval('wrong-secret', subscriberId, signature)).toBe(false);
	});

	it('rejects malformed tokens and signatures', async () => {
		expect(validConfirmationToken('too-short')).toBe(false);
		expect(await verifyRemoval('a-secure-test-secret', crypto.randomUUID(), 'not-a-signature')).toBe(false);
	});

	it('keeps unique valid confirmation-token copies in fallback order', () => {
		const formToken = createConfirmationToken();
		const queryToken = createConfirmationToken();
		expect(confirmationTokenCandidates(formToken, queryToken, formToken, null, 'invalid')).toEqual([
			formToken,
			queryToken,
		]);
	});
});
