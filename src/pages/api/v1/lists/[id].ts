import type { APIRoute } from 'astro';
import { apiError, jsonResponse, readJsonObject, requireApiKey } from '../../../../lib/api';
import { getWaitingListById, getWaitingListSummaryById, updateWaitingList } from '../../../../lib/db';
import { waitingListIntegration } from '../../../../lib/integration';
import { getBindings } from '../../../../lib/runtime';
import { parseWaitingListDetails } from '../../../../lib/validation';

export const prerender = false;

export const GET: APIRoute = async ({ params, request }) => {
	const bindings = getBindings();
	const authentication = await requireApiKey(bindings.DB, request, 'lists:read');
	if (authentication instanceof Response) return authentication;

	const list = await getWaitingListSummaryById(bindings.DB, params.id ?? '');
	if (!list) return apiError(404, 'not_found', 'Waiting list not found.');
	return jsonResponse({
		data: {
			...list,
			subscriber_count: Number(list.subscriber_count),
			pending_count: Number(list.pending_count),
			integration: waitingListIntegration(new URL(request.url).origin, list),
		},
	});
};

export const PATCH: APIRoute = async ({ params, request }) => {
	const bindings = getBindings();
	const authentication = await requireApiKey(bindings.DB, request, 'lists:write');
	if (authentication instanceof Response) return authentication;

	const list = await getWaitingListById(bindings.DB, params.id ?? '');
	if (!list) return apiError(404, 'not_found', 'Waiting list not found.');
	const body = await readJsonObject(request);
	if (!body) return apiError(400, 'invalid_json', 'Send a small application/json object.');
	const parsed = parseWaitingListDetails({
		name: body.name ?? list.name,
		slug: body.slug ?? list.slug,
		allowed_origins: body.allowed_origins ?? body.allowedOrigins ?? list.allowed_origins,
	});
	if (!parsed) return apiError(422, 'invalid_list', 'Provide valid waiting-list settings.');

	try {
		await updateWaitingList(bindings.DB, list.id, parsed);
		const updated = await getWaitingListSummaryById(bindings.DB, list.id);
		if (!updated) return apiError(404, 'not_found', 'Waiting list not found.');
		return jsonResponse({
			data: {
				...updated,
				subscriber_count: Number(updated.subscriber_count),
				pending_count: Number(updated.pending_count),
				integration: waitingListIntegration(new URL(request.url).origin, updated),
			},
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		if (message.includes('UNIQUE constraint failed')) {
			return apiError(409, 'slug_conflict', 'That endpoint slug is already in use.');
		}
		console.error(JSON.stringify({ message: 'API waiting list update failed', listId: list.id, error: message }));
		return apiError(500, 'update_failed', 'Unable to update the waiting list.');
	}
};
