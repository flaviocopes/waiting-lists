import type { APIRoute } from 'astro';
import { getSession, verifyCsrf } from '../../../../lib/auth';
import { deleteSubscriberById, getSubscriberListSlug } from '../../../../lib/db';
import { getBindings } from '../../../../lib/runtime';

export const prerender = false;

export const POST: APIRoute = async ({ params, request }) => {
	const bindings = getBindings();
	const session = await getSession(bindings.DB, request, bindings.SESSION_SECRET);
	if (!session) return Response.redirect(new URL('/login', request.url), 303);
	if (!(await verifyCsrf(request.clone(), session.csrfToken))) return new Response('Forbidden', { status: 403 });

	const subscriberId = params.id ?? '';
	const list = await getSubscriberListSlug(bindings.DB, subscriberId);
	if (!list) return new Response('Subscriber not found', { status: 404 });

	await deleteSubscriberById(bindings.DB, subscriberId);
	return Response.redirect(new URL(`/admin/lists/${list.slug}?deleted=1`, request.url), 303);
};
