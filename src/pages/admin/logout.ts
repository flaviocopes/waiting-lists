import type { APIRoute } from 'astro';
import { destroySession, getSession, verifyCsrf } from '../../lib/auth';
import { getBindings } from '../../lib/runtime';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
	const bindings = getBindings();
	const session = await getSession(bindings.DB, request, bindings.SESSION_SECRET);
	if (session && !(await verifyCsrf(request.clone(), session.csrfToken))) {
		return new Response('Forbidden', { status: 403 });
	}
	const cookie = await destroySession(bindings.DB, request, bindings.SESSION_SECRET);
	return new Response(null, { status: 303, headers: { Location: '/login', 'Set-Cookie': cookie } });
};
