import {
	csvExportFilename,
	csvExportHeader,
	csvExportRow,
	type CsvExportFormat,
} from './csv-export';
import { getSubscriberBatch, type Subscriber } from './db';

async function* csvRows(db: D1Database, listId: string, format: CsvExportFormat) {
	yield csvExportHeader(format);
	let cursor: { createdAt: string; id: string } | undefined;
	while (true) {
		const batch = await getSubscriberBatch(db, listId, 500, cursor);
		if (batch.length === 0) break;
		for (const row of batch) yield csvExportRow(format, row);
		const last: Subscriber = batch[batch.length - 1];
		cursor = { createdAt: last.created_at, id: last.id };
		if (batch.length < 500) break;
	}
}

export function csvExportResponse(db: D1Database, listId: string, slug: string, format: CsvExportFormat) {
	const encoder = new TextEncoder();
	const iterator = csvRows(db, listId, format)[Symbol.asyncIterator]();
	const stream = new ReadableStream<Uint8Array>({
		async pull(controller) {
			try {
				const result = await iterator.next();
				if (result.done) controller.close();
				else controller.enqueue(encoder.encode(result.value));
			} catch (error) {
				console.error(JSON.stringify({
					message: 'csv stream failed',
					listId,
					error: error instanceof Error ? error.message : String(error),
				}));
				controller.error(error);
			}
		},
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/csv; charset=utf-8',
			'Content-Disposition': `attachment; filename="${csvExportFilename(slug, format)}"`,
			'Cache-Control': 'no-store',
		},
	});
}
