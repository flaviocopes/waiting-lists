import { applyEmailDeliveryEvent } from './db';

export const EMAIL_DELIVERY_EVENT_TYPES = [
	'cf.email.sending.message.delivered',
	'cf.email.sending.message.deferred',
	'cf.email.sending.message.bounced',
	'cf.email.sending.message.failed',
	'cf.email.sending.message.rejected',
	'cf.email.sending.message.complained',
] as const;

export type EmailDeliveryStatus =
	| 'submitting'
	| 'processing'
	| 'deferred'
	| 'delivered'
	| 'bounced'
	| 'failed'
	| 'rejected'
	| 'complained';

export type EmailDeliveryUpdate = {
	messageId: string;
	status: Exclude<EmailDeliveryStatus, 'submitting' | 'processing'>;
	terminal: boolean;
	provider: string | null;
	smtpStatusCode: string | null;
	detail: string | null;
	eventAt: string;
};

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function optionalString(value: unknown): string | null {
	return typeof value === 'string' && value.length > 0 ? value.slice(0, 500) : null;
}

export function normalizeMessageId(value: string): string {
	const trimmed = value.trim();
	return trimmed.startsWith('<') && trimmed.endsWith('>') ? trimmed.slice(1, -1).trim() : trimmed;
}

export function parseEmailDeliveryEvent(body: unknown, expectedDomain: string): EmailDeliveryUpdate | null {
	if (!isObject(body) || typeof body.type !== 'string') return null;
	if (!EMAIL_DELIVERY_EVENT_TYPES.includes(body.type as (typeof EMAIL_DELIVERY_EVENT_TYPES)[number])) return null;
	if (!isObject(body.source) || body.source.type !== 'email.sending' || body.source.domain !== expectedDomain) return null;
	if (!isObject(body.payload) || !isObject(body.metadata)) return null;

	const messageId = typeof body.payload.messageId === 'string' ? normalizeMessageId(body.payload.messageId) : '';
	const eventAt = typeof body.metadata.eventTimestamp === 'string' ? body.metadata.eventTimestamp : '';
	if (!messageId || !Number.isFinite(Date.parse(eventAt))) return null;

	const status = body.type.slice('cf.email.sending.message.'.length) as EmailDeliveryUpdate['status'];
	const delivery = isObject(body.payload.delivery) ? body.payload.delivery : {};
	const bounce = isObject(body.payload.bounce) ? body.payload.bounce : {};
	const failure = isObject(body.payload.failure) ? body.payload.failure : {};
	const rejection = isObject(body.payload.rejection) ? body.payload.rejection : {};
	const complaint = isObject(body.payload.complaint) ? body.payload.complaint : {};
	const detail =
		optionalString(rejection.detail) ??
		optionalString(bounce.reason) ??
		optionalString(failure.reason) ??
		optionalString(complaint.type) ??
		optionalString(delivery.smtpResponse);

	return {
		messageId,
		status,
		terminal: body.payload.terminal === true,
		provider: optionalString(delivery.provider),
		smtpStatusCode: optionalString(delivery.smtpStatusCode),
		detail,
		eventAt,
	};
}

export async function consumeEmailDeliveryEvents(batch: MessageBatch<unknown>, env: Env): Promise<void> {
	const expectedDomain = new URL(env.APP_URL).hostname;
	for (const message of batch.messages) {
		try {
			const event = parseEmailDeliveryEvent(message.body, expectedDomain);
			if (!event) {
				console.warn(JSON.stringify({ message: 'ignored invalid email delivery event', queueMessageId: message.id }));
				message.ack();
				continue;
			}

			const matched = await applyEmailDeliveryEvent(env.DB, event);
			if (!matched && message.attempts < 3) {
				message.retry({ delaySeconds: 10 });
				continue;
			}
			if (!matched) {
				console.warn(JSON.stringify({
					message: 'email delivery event did not match a tracked message',
					queueMessageId: message.id,
					messageId: event.messageId,
				}));
			}
			message.ack();
		} catch (error) {
			console.error(JSON.stringify({
				message: 'email delivery event processing failed',
				queueMessageId: message.id,
				error: error instanceof Error ? error.message : String(error),
			}));
			message.retry({ delaySeconds: 15 });
		}
	}
}
