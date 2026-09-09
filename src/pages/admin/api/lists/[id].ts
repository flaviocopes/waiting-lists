import type { APIRoute } from 'astro';
import { getSession, verifyCsrf } from '../../../../lib/auth';
import { getWaitingListById, updateWaitingList } from '../../../../lib/db';
import { getBindings } from '../../../../lib/runtime';
import { parseWaitingListDetails } from '../../../../lib/validation';

export const prerender = false;

function settingsUrl(request: Request, slug: string, result: string) {
	return new URL(`/admin/lists/${slug}?tab=settings&${result}`, request.url);
}

export const POST: APIRoute = async ({ params, request }) => {
	const bindings = getBindings();
	const session = await getSession(bindings.DB, request, bindings.SESSION_SECRET);
	if (!session) return Response.redirect(new URL('/login', request.url), 303);
	if (!(await verifyCsrf(request.clone(), session.csrfToken))) return new Response('Forbidden', { status: 403 });

	const list = await getWaitingListById(bindings.DB, params.id ?? '');
	if (!list) return new Response('Waiting list not found', { status: 404 });

	const form = await request.formData();
	const parsed = parseWaitingListDetails(Object.fromEntries(form.entries()));
	if (!parsed) return Response.redirect(settingsUrl(request, list.slug, 'update_error=invalid'), 303);

	try {
		const updated = await updateWaitingList(bindings.DB, list.id, parsed);
		if (!updated) return new Response('Waiting list not found', { status: 404 });
		return Response.redirect(settingsUrl(request, parsed.slug, 'updated=1'), 303);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		if (message.includes('UNIQUE constraint failed')) {
			return Response.redirect(settingsUrl(request, list.slug, 'update_error=duplicate'), 303);
		}
		console.error(JSON.stringify({ message: 'waiting list update failed', listId: list.id, error: message }));
		return new Response('Unable to update waiting list', { status: 500 });
	}
};
