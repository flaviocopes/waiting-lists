import type { APIRoute } from 'astro';
import { getSession, verifyCsrf } from '../../../../../lib/auth';
import {
	beginEmailDelivery,
	markEmailDeliveryProcessing,
	markEmailDeliverySubmissionFailed,
	renewPendingSubscriberConfirmation,
} from '../../../../../lib/db';
import { sendConfirmationEmail } from '../../../../../lib/email';
import { normalizeMessageId } from '../../../../../lib/email-events';
import { getBindings } from '../../../../../lib/runtime';
import { createConfirmationToken, hashConfirmationToken, signRemoval } from '../../../../../lib/subscriber-tokens';

export const prerender = false;

export const POST: APIRoute = async ({ params, request }) => {
	const bindings = getBindings();
	const session = await getSession(bindings.DB, request, bindings.SESSION_SECRET);
	if (!session) return Response.redirect(new URL('/login', request.url), 303);
	if (!(await verifyCsrf(request.clone(), session.csrfToken))) return new Response('Forbidden', { status: 403 });

	const token = createConfirmationToken();
	const subscriber = await renewPendingSubscriberConfirmation(bindings.DB, {
		subscriberId: params.id ?? '',
		tokenHash: await hashConfirmationToken(bindings.SUBSCRIBER_TOKEN_SECRET || bindings.SESSION_SECRET, token),
		expiresAt: Math.floor(Date.now() / 1000) + 24 * 60 * 60,
	});
	if (!subscriber) return new Response('Pending subscriber not found', { status: 404 });

	const deliveryId = await beginEmailDelivery(bindings.DB, subscriber.id);
	try {
		const result = await sendConfirmationEmail(bindings, {
			email: subscriber.email,
			listName: subscriber.list_name,
			token,
			subscriberId: subscriber.id,
			removalSignature: await signRemoval(bindings.SUBSCRIBER_TOKEN_SECRET || bindings.SESSION_SECRET, subscriber.id),
		});
		try {
			await markEmailDeliveryProcessing(bindings.DB, deliveryId, normalizeMessageId(result.messageId));
		} catch (trackingError) {
			console.error(JSON.stringify({
				message: 'resent confirmation email accepted but delivery tracking failed',
				deliveryId,
				error: trackingError instanceof Error ? trackingError.message : String(trackingError),
			}));
		}
		return Response.redirect(new URL(`/admin/lists/${subscriber.list_slug}?tab=subscribers&resent=1`, request.url), 303);
	} catch (sendError) {
		try {
			await markEmailDeliverySubmissionFailed(
				bindings.DB,
				deliveryId,
				sendError instanceof Error ? sendError.message : 'Cloudflare rejected the submission.',
			);
		} catch (trackingError) {
			console.error(JSON.stringify({
				message: 'resent confirmation submission and failure tracking both failed',
				deliveryId,
				error: trackingError instanceof Error ? trackingError.message : String(trackingError),
			}));
		}
		return Response.redirect(new URL(`/admin/lists/${subscriber.list_slug}?tab=subscribers&resend=failed`, request.url), 303);
	}
};
