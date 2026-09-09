import type { APIRoute } from 'astro';
import {
	beginEmailDelivery,
	getWaitingListBySlug,
	markEmailDeliveryProcessing,
	markEmailDeliverySubmissionFailed,
	purgeExpiredPending,
	requestDoubleOptIn,
} from '../../../lib/db';
import { sendConfirmationEmail } from '../../../lib/email';
import { normalizeMessageId } from '../../../lib/email-events';
import { getBindings } from '../../../lib/runtime';
import { createConfirmationToken, hashConfirmationToken, signRemoval } from '../../../lib/subscriber-tokens';
import { parseEmail } from '../../../lib/validation';

export const prerender = false;

function originAllowed(allowedOrigins: string, origin: string | null) {
	if (!origin || allowedOrigins === '*') return true;
	return allowedOrigins.split(',').map((value) => value.trim()).includes(origin);
}

function corsHeaders(allowedOrigins: string, origin: string | null) {
	const headers = new Headers({
		'Access-Control-Allow-Headers': 'Content-Type',
		'Access-Control-Allow-Methods': 'POST, OPTIONS',
		'Access-Control-Max-Age': '86400',
		'Vary': 'Origin',
	});
	if (allowedOrigins === '*') headers.set('Access-Control-Allow-Origin', '*');
	else if (origin && originAllowed(allowedOrigins, origin)) headers.set('Access-Control-Allow-Origin', origin);
	return headers;
}

function resultResponse(request: Request, status: number, message: string, headers = new Headers()) {
	if (request.headers.get('HX-Request') === 'true') {
		headers.set('Content-Type', 'text/html; charset=utf-8');
		return new Response(message, { status, headers });
	}
	return Response.json({ ok: status < 400, message }, { status, headers });
}

function consentAccepted(value: unknown): boolean {
	return value === true || value === 1 || value === '1' || value === 'yes' || value === 'on';
}

async function readSubscriptionRequest(request: Request) {
	const declaredLength = Number(request.headers.get('content-length') ?? 0);
	if (declaredLength > 2048) return null;

	const reader = request.body?.getReader();
	if (!reader) return null;
	const chunks: Uint8Array[] = [];
	let received = 0;
	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		received += value.byteLength;
		if (received > 2048) {
			await reader.cancel();
			return null;
		}
		chunks.push(value);
	}
	const bodyBytes = new Uint8Array(received);
	let offset = 0;
	for (const chunk of chunks) {
		bodyBytes.set(chunk, offset);
		offset += chunk.byteLength;
	}
	const bodyText = new TextDecoder().decode(bodyBytes);
	const contentType = request.headers.get('content-type')?.split(';')[0].trim();
	if (contentType === 'application/json') {
		const body: unknown = JSON.parse(bodyText);
		if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
		const entries = Object.entries(body);
		if (entries.length !== 2 || !('email' in body) || !('consent' in body)) return null;
		const input = body as { email?: unknown; consent?: unknown };
		if (!consentAccepted(input.consent)) return null;
		return parseEmail(input.email);
	}
	if (contentType === 'application/x-www-form-urlencoded') {
		const form = new URLSearchParams(bodyText);
		if (form.size !== 2 || form.getAll('email').length !== 1 || form.getAll('consent').length !== 1) return null;
		if (!consentAccepted(form.get('consent'))) return null;
		return parseEmail(form.get('email'));
	}
	return null;
}

export const OPTIONS: APIRoute = async ({ params, request }) => {
	const bindings = getBindings();
	const list = await getWaitingListBySlug(bindings.DB, params.slug ?? '');
	if (!list) return new Response(null, { status: 404 });
	const origin = request.headers.get('origin');
	if (!originAllowed(list.allowed_origins, origin)) return new Response(null, { status: 403 });
	return new Response(null, { status: 204, headers: corsHeaders(list.allowed_origins, origin) });
};

export const POST: APIRoute = async ({ params, request }) => {
	const bindings = getBindings();
	const list = await getWaitingListBySlug(bindings.DB, params.slug ?? '');
	if (!list) return resultResponse(request, 404, 'Waiting list not found.');

	const origin = request.headers.get('origin');
	const headers = corsHeaders(list.allowed_origins, origin);
	headers.set('Cache-Control', 'no-store');
	if (!originAllowed(list.allowed_origins, origin)) {
		return resultResponse(request, 403, 'This website is not allowed to submit to this list.', headers);
	}

	const clientKey = request.headers.get('cf-connecting-ip') ?? 'local';
	const rate = await bindings.SUBSCRIBE_RATE_LIMIT.limit({ key: `${list.id}:${clientKey}` });
	if (!rate.success) return resultResponse(request, 429, 'Too many attempts. Please try again in a minute.', headers);

	let email: string | null = null;
	try {
		email = await readSubscriptionRequest(request);
	} catch {
		return resultResponse(request, 400, 'Send a valid email and explicit consent.', headers);
	}
	if (!email) return resultResponse(request, 400, 'Enter a valid email and agree to join the waitlist.', headers);

	try {
		const now = Math.floor(Date.now() / 1000);
		const subscriberSecret = bindings.SUBSCRIBER_TOKEN_SECRET || bindings.SESSION_SECRET;
		const emailRateKey = await hashConfirmationToken(subscriberSecret, email);
		const emailRate = await bindings.SUBSCRIBE_RATE_LIMIT.limit({ key: `${list.id}:email:${emailRateKey}` });
		if (!emailRate.success) {
			return resultResponse(request, 429, 'Too many attempts. Please try again in a minute.', headers);
		}
		await purgeExpiredPending(bindings.DB, now);
		const token = createConfirmationToken();
		const tokenHash = await hashConfirmationToken(subscriberSecret, token);
		const subscription = await requestDoubleOptIn(bindings.DB, {
			listId: list.id,
			email,
			tokenHash,
			expiresAt: now + 24 * 60 * 60,
			consentVersion: bindings.CONSENT_VERSION,
		});

		if (subscription.shouldSend) {
			const removalSignature = await signRemoval(subscriberSecret, subscription.subscriberId);
			const deliveryId = await beginEmailDelivery(bindings.DB, subscription.subscriberId);
			try {
				const result = await sendConfirmationEmail(bindings, {
					email,
					listName: list.name,
					token,
					subscriberId: subscription.subscriberId,
					removalSignature,
				});
				try {
					await markEmailDeliveryProcessing(bindings.DB, deliveryId, normalizeMessageId(result.messageId));
				} catch (trackingError) {
					console.error(JSON.stringify({
						message: 'confirmation email accepted but delivery tracking failed',
						listId: list.id,
						deliveryId,
						error: trackingError instanceof Error ? trackingError.message : String(trackingError),
					}));
				}
			} catch (sendError) {
				try {
					await markEmailDeliverySubmissionFailed(
						bindings.DB,
						deliveryId,
						sendError instanceof Error ? sendError.message : 'Cloudflare rejected the submission.',
					);
				} catch (trackingError) {
					console.error(JSON.stringify({
						message: 'confirmation submission and failure tracking both failed',
						listId: list.id,
						deliveryId,
						error: trackingError instanceof Error ? trackingError.message : String(trackingError),
					}));
				}
				throw sendError;
			}
		}

		return resultResponse(request, 202, 'Thanks — you’re on the waitlist. Check your inbox if a confirmation step is needed.', headers);
	} catch (error) {
		console.error(JSON.stringify({
			message: 'double opt-in request failed',
			listId: list.id,
			error: error instanceof Error ? error.message : String(error),
		}));
		return resultResponse(request, 503, 'We couldn’t submit your confirmation email for delivery. Please try again.', headers);
	}
};
