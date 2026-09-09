import type { APIRoute } from 'astro';
import { getSession, verifyCsrf } from '../../../lib/auth';
import { createWaitingList } from '../../../lib/db';
import { getBindings } from '../../../lib/runtime';
import { parseWaitingListDetails } from '../../../lib/validation';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
	const bindings = getBindings();
	const session = await getSession(bindings.DB, request, bindings.SESSION_SECRET);
	if (!session) return Response.redirect(new URL('/login', request.url), 303);
	if (!(await verifyCsrf(request.clone(), session.csrfToken))) return new Response('Forbidden', { status: 403 });

	const form = await request.formData();
	const parsed = parseWaitingListDetails(Object.fromEntries(form.entries()));
	if (!parsed) return Response.redirect(new URL('/admin?error=invalid', request.url), 303);

	try {
		await createWaitingList(bindings.DB, parsed);
		return Response.redirect(new URL('/admin?created=1', request.url), 303);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		if (message.includes('UNIQUE constraint failed')) {
			return Response.redirect(new URL('/admin?error=duplicate', request.url), 303);
		}
		console.error(JSON.stringify({ message: 'waiting list creation failed', error: message }));
		return new Response('Unable to create waiting list', { status: 500 });
	}
};
