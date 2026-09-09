import type { APIRoute } from 'astro';
import { apiError, jsonResponse, requireApiKey } from '../../../../../lib/api';
import { getWaitingListById } from '../../../../../lib/db';
import { waitingListIntegration } from '../../../../../lib/integration';
import { getBindings } from '../../../../../lib/runtime';

export const prerender = false;

export const GET: APIRoute = async ({ params, request }) => {
	const bindings = getBindings();
	const authentication = await requireApiKey(bindings.DB, request, 'lists:read');
	if (authentication instanceof Response) return authentication;

	const list = await getWaitingListById(bindings.DB, params.id ?? '');
	if (!list) return apiError(404, 'not_found', 'Waiting list not found.');
	return jsonResponse({ data: waitingListIntegration(new URL(request.url).origin, list) });
};
