import type { APIRoute } from 'astro';
import { apiError, requireApiKey } from '../../../../../lib/api';
import { parseCsvExportFormat } from '../../../../../lib/csv-export';
import { csvExportResponse } from '../../../../../lib/csv-stream';
import { getWaitingListById } from '../../../../../lib/db';
import { getBindings } from '../../../../../lib/runtime';

export const prerender = false;

export const GET: APIRoute = async ({ params, request }) => {
	const bindings = getBindings();
	const authentication = await requireApiKey(bindings.DB, request, 'subscribers:export');
	if (authentication instanceof Response) return authentication;

	const list = await getWaitingListById(bindings.DB, params.id ?? '');
	if (!list) return apiError(404, 'not_found', 'Waiting list not found.');
	const format = parseCsvExportFormat(new URL(request.url).searchParams.get('format'));
	if (!format) return apiError(400, 'unsupported_format', 'Use archive, universal, sendy, kit, or mailchimp.');
	return csvExportResponse(bindings.DB, list.id, list.slug, format);
};
