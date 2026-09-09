import type { APIRoute } from 'astro';
import { apiError, jsonResponse, readJsonObject, requireApiKey } from '../../../../lib/api';
import { createWaitingList, getWaitingListById, getWaitingLists } from '../../../../lib/db';
import { waitingListIntegration } from '../../../../lib/integration';
import { getBindings } from '../../../../lib/runtime';
import { parseWaitingListDetails } from '../../../../lib/validation';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
	const bindings = getBindings();
	const authentication = await requireApiKey(bindings.DB, request, 'lists:read');
	if (authentication instanceof Response) return authentication;

	const origin = new URL(request.url).origin;
	const lists = (await getWaitingLists(bindings.DB)).map((list) => ({
		...list,
		subscriber_count: Number(list.subscriber_count),
		pending_count: Number(list.pending_count),
		endpoint: waitingListIntegration(origin, list).endpoint,
	}));
	return jsonResponse({ data: lists });
};

export const POST: APIRoute = async ({ request }) => {
	const bindings = getBindings();
	const authentication = await requireApiKey(bindings.DB, request, 'lists:write');
	if (authentication instanceof Response) return authentication;

	const body = await readJsonObject(request);
	if (!body) return apiError(400, 'invalid_json', 'Send a small application/json object.');
	const parsed = parseWaitingListDetails({
		name: body.name,
		slug: body.slug,
		allowed_origins: body.allowed_origins ?? body.allowedOrigins ?? '*',
	});
	if (!parsed) {
		return apiError(422, 'invalid_list', 'Provide a valid name, slug, and comma-separated allowed_origins value.');
	}

	try {
		const id = await createWaitingList(bindings.DB, parsed);
		const list = await getWaitingListById(bindings.DB, id);
		if (!list) return apiError(500, 'creation_failed', 'The waiting list could not be loaded after creation.');
		return jsonResponse({ data: { ...list, integration: waitingListIntegration(new URL(request.url).origin, list) } }, { status: 201 });
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		if (message.includes('UNIQUE constraint failed')) {
			return apiError(409, 'slug_conflict', 'That endpoint slug is already in use.');
		}
		console.error(JSON.stringify({ message: 'API waiting list creation failed', error: message }));
		return apiError(500, 'creation_failed', 'Unable to create the waiting list.');
	}
};
