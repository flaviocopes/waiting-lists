import { describe, expect, it } from 'vitest';
import { normalizeMessageId, parseEmailDeliveryEvent } from './email-events';

describe('email delivery events', () => {
	it('normalizes Message-ID angle brackets', () => {
		expect(normalizeMessageId(' <abc@example.com> ')).toBe('abc@example.com');
	});

	it('parses a terminal failure without storing recipient or subject data', () => {
		const event = parseEmailDeliveryEvent({
			type: 'cf.email.sending.message.failed',
			source: { type: 'email.sending', domain: 'waitinglists.dev' },
			payload: {
				messageId: '<abc@example.com>',
				recipient: 'person@example.net',
				subject: 'Confirm',
				terminal: true,
				delivery: { status: 'failed' },
				failure: { reason: 'delivery_failed' },
			},
			metadata: { eventTimestamp: '2026-07-30T15:08:13.000Z' },
		}, 'waitinglists.dev');

		expect(event).toEqual({
			messageId: 'abc@example.com',
			status: 'failed',
			terminal: true,
			provider: null,
			smtpStatusCode: null,
			detail: 'delivery_failed',
			eventAt: '2026-07-30T15:08:13.000Z',
		});
		expect(event).not.toHaveProperty('recipient');
		expect(event).not.toHaveProperty('subject');
	});

	it('rejects events from another domain', () => {
		expect(parseEmailDeliveryEvent({
			type: 'cf.email.sending.message.delivered',
			source: { type: 'email.sending', domain: 'other.example' },
			payload: { messageId: 'abc', terminal: true, delivery: { status: 'delivered' } },
			metadata: { eventTimestamp: '2026-07-30T15:08:13.000Z' },
		}, 'waitinglists.dev')).toBeNull();
	});
});
