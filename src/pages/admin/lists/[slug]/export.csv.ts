import type { APIRoute } from 'astro';
import { getSession } from '../../../../lib/auth';
import { parseCsvExportFormat } from '../../../../lib/csv-export';
import { csvExportResponse } from '../../../../lib/csv-stream';
import { getWaitingListBySlug } from '../../../../lib/db';
import { getBindings } from '../../../../lib/runtime';

export const prerender = false;

export const GET: APIRoute = async ({ params, request }) => {
	const bindings = getBindings();
	const session = await getSession(bindings.DB, request, bindings.SESSION_SECRET);
	if (!session) return Response.redirect(new URL('/login', request.url), 303);

	const list = await getWaitingListBySlug(bindings.DB, params.slug ?? '');
	if (!list) return new Response('Waiting list not found', { status: 404 });
	const format = parseCsvExportFormat(new URL(request.url).searchParams.get('format'));
	if (!format) return new Response('Unsupported CSV export format', { status: 400 });

	return csvExportResponse(bindings.DB, list.id, list.slug, format);
};
