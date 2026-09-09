import { describe, expect, it, vi } from 'vitest';
import { verifyTurnstile } from './turnstile';

const baseInput = {
	token: 'valid-token',
	secret: 'test-secret',
	expectedAction: 'login',
	allowedHostnames: 'waitinglists.dev,www.waitinglists.dev',
};

describe('Turnstile verification', () => {
	it('accepts only the expected action and hostname', async () => {
		const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
			new Response(JSON.stringify({ success: true, action: 'login', hostname: 'waitinglists.dev' }), {
				status: 200,
			}),
		);

		expect(await verifyTurnstile({ ...baseInput, fetcher })).toBe(true);
		expect(fetcher).toHaveBeenCalledOnce();
	});

	it('rejects successful tokens issued for another action or hostname', async () => {
		const wrongAction = vi.fn<typeof fetch>().mockResolvedValue(
			new Response(JSON.stringify({ success: true, action: 'signup', hostname: 'waitinglists.dev' })),
		);
		const wrongHostname = vi.fn<typeof fetch>().mockResolvedValue(
			new Response(JSON.stringify({ success: true, action: 'login', hostname: 'attacker.example' })),
		);

		expect(await verifyTurnstile({ ...baseInput, fetcher: wrongAction })).toBe(false);
		expect(await verifyTurnstile({ ...baseInput, fetcher: wrongHostname })).toBe(false);
	});

	it('fails closed for malformed tokens and upstream failures', async () => {
		const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new Error('network unavailable'));

		expect(await verifyTurnstile({ ...baseInput, token: '', fetcher })).toBe(false);
		expect(await verifyTurnstile({ ...baseInput, fetcher })).toBe(false);
		expect(fetcher).toHaveBeenCalledOnce();
	});
});
