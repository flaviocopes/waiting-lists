import type { EmailDeliveryStatus, EmailDeliveryUpdate } from './email-events';

export type WaitingList = {
	id: string;
	name: string;
	slug: string;
	allowed_origins: string;
	created_at: string;
};

export type WaitingListSummary = WaitingList & { subscriber_count: number; pending_count: number };

export type GlobalSettings = {
	admin_email: string;
	notify_on_join: number;
	admin_username: string;
	admin_password_hash: string | null;
	updated_at: string;
};

export type Subscriber = {
	id: string;
	email: string;
	status: 'pending' | 'confirmed';
	created_at: string;
	confirmed_at: string | null;
	confirmed_country: string | null;
	consent_at: string | null;
	consent_version: string | null;
	email_delivery_status: EmailDeliveryStatus | null;
	email_delivery_detail: string | null;
	email_delivery_updated_at: string | null;
};

export type EmailDeliveryAlert = {
	delivery_id: string;
	email: string;
	list_name: string;
	list_slug: string;
	status: Extract<EmailDeliveryStatus, 'bounced' | 'failed' | 'rejected' | 'complained'>;
	detail: string | null;
	smtp_status_code: string | null;
	updated_at: string;
};

export async function getWaitingListBySlug(db: D1Database, slug: string) {
	return db
		.prepare('SELECT id, name, slug, allowed_origins, created_at FROM waiting_lists WHERE slug = ?')
		.bind(slug)
		.first<WaitingList>();
}

export async function getGlobalSettings(db: D1Database) {
	return db
		.prepare(`
			SELECT admin_email, notify_on_join, admin_username, admin_password_hash, updated_at
			FROM global_settings WHERE id = 1
		`)
		.first<GlobalSettings>();
}

export async function updateNotificationSettings(
	db: D1Database,
	input: { adminEmail: string; notifyOnJoin: boolean },
) {
	const result = await db
		.prepare(`
			UPDATE global_settings
			SET admin_email = ?, notify_on_join = ?, updated_at = CURRENT_TIMESTAMP
			WHERE id = 1
		`)
		.bind(input.adminEmail, input.notifyOnJoin ? 1 : 0)
		.run();
	return result.meta.changes === 1;
}

export async function updateAdminCredentials(
	db: D1Database,
	input: { username: string; passwordHash?: string },
) {
	const result = input.passwordHash
		? await db
			.prepare(`
				UPDATE global_settings
				SET admin_username = ?, admin_password_hash = ?, updated_at = CURRENT_TIMESTAMP
				WHERE id = 1
			`)
			.bind(input.username, input.passwordHash)
			.run()
		: await db
			.prepare(`
				UPDATE global_settings
				SET admin_username = ?, updated_at = CURRENT_TIMESTAMP
				WHERE id = 1
			`)
			.bind(input.username)
			.run();
	return result.meta.changes === 1;
}

export async function getWaitingListById(db: D1Database, id: string) {
	return db
		.prepare('SELECT id, name, slug, allowed_origins, created_at FROM waiting_lists WHERE id = ?')
		.bind(id)
		.first<WaitingList>();
}

export async function getWaitingListSummaryById(db: D1Database, id: string) {
	return db
		.prepare(`
			SELECT w.id, w.name, w.slug, w.allowed_origins, w.created_at,
				SUM(CASE WHEN s.status = 'confirmed' THEN 1 ELSE 0 END) AS subscriber_count,
				SUM(CASE WHEN s.status = 'pending' THEN 1 ELSE 0 END) AS pending_count
			FROM waiting_lists w
			LEFT JOIN subscribers s ON s.list_id = w.id
			WHERE w.id = ?
			GROUP BY w.id
		`)
		.bind(id)
		.first<WaitingListSummary>();
}

export async function getWaitingLists(db: D1Database) {
	const result = await db
		.prepare(`
			SELECT w.id, w.name, w.slug, w.allowed_origins, w.created_at,
				SUM(CASE WHEN s.status = 'confirmed' THEN 1 ELSE 0 END) AS subscriber_count,
				SUM(CASE WHEN s.status = 'pending' THEN 1 ELSE 0 END) AS pending_count
			FROM waiting_lists w
			LEFT JOIN subscribers s ON s.list_id = w.id
			GROUP BY w.id
			ORDER BY w.created_at DESC
		`)
		.all<WaitingListSummary>();
	return result.results;
}

export async function createWaitingList(
	db: D1Database,
	input: { name: string; slug: string; allowedOrigins: string },
) {
	const id = crypto.randomUUID();
	await db
		.prepare('INSERT INTO waiting_lists (id, name, slug, allowed_origins) VALUES (?, ?, ?, ?)')
		.bind(id, input.name, input.slug, input.allowedOrigins)
		.run();
	return id;
}

export async function updateWaitingList(
	db: D1Database,
	id: string,
	input: { name: string; slug: string; allowedOrigins: string },
) {
	const result = await db
		.prepare('UPDATE waiting_lists SET name = ?, slug = ?, allowed_origins = ? WHERE id = ?')
		.bind(input.name, input.slug, input.allowedOrigins, id)
		.run();
	return result.meta.changes === 1;
}

export async function requestDoubleOptIn(
	db: D1Database,
	input: { listId: string; email: string; tokenHash: string; expiresAt: number; consentVersion: string },
) {
	const candidateId = crypto.randomUUID();
	await db
		.prepare(`
			INSERT INTO subscribers (
				id, list_id, email, status, consent_at, consent_version,
				confirmation_token_hash, confirmation_expires_at
			) VALUES (?, ?, ?, 'pending', CURRENT_TIMESTAMP, ?, ?, ?)
			ON CONFLICT(list_id, email) DO UPDATE SET
				consent_at = CASE
					WHEN subscribers.status = 'pending' AND (subscribers.confirmation_expires_at IS NULL OR subscribers.confirmation_expires_at <= excluded.confirmation_expires_at - 600)
					THEN CURRENT_TIMESTAMP ELSE subscribers.consent_at END,
				consent_version = CASE
					WHEN subscribers.status = 'pending' AND (subscribers.confirmation_expires_at IS NULL OR subscribers.confirmation_expires_at <= excluded.confirmation_expires_at - 600)
					THEN excluded.consent_version ELSE subscribers.consent_version END,
				confirmation_token_hash = CASE
					WHEN subscribers.status = 'pending' AND (subscribers.confirmation_expires_at IS NULL OR subscribers.confirmation_expires_at <= excluded.confirmation_expires_at - 600)
					THEN excluded.confirmation_token_hash ELSE subscribers.confirmation_token_hash END,
				confirmation_expires_at = CASE
					WHEN subscribers.status = 'pending' AND (subscribers.confirmation_expires_at IS NULL OR subscribers.confirmation_expires_at <= excluded.confirmation_expires_at - 600)
					THEN excluded.confirmation_expires_at ELSE subscribers.confirmation_expires_at END
		`)
		.bind(candidateId, input.listId, input.email, input.consentVersion, input.tokenHash, input.expiresAt)
		.run();

	const row = await db
		.prepare('SELECT id, status, confirmation_token_hash FROM subscribers WHERE list_id = ? AND email = ?')
		.bind(input.listId, input.email)
		.first<{ id: string; status: string; confirmation_token_hash: string | null }>();
	if (!row) throw new Error('Subscriber upsert did not return a row');
	if (row.status === 'pending' && row.confirmation_token_hash !== input.tokenHash) {
		const latestDelivery = await db
			.prepare(`
				SELECT status FROM email_deliveries
				WHERE subscriber_id = ?
				ORDER BY created_at DESC, id DESC LIMIT 1
			`)
			.bind(row.id)
			.first<{ status: EmailDeliveryStatus }>();
		if (latestDelivery && ['bounced', 'failed', 'rejected'].includes(latestDelivery.status)) {
			await db
				.prepare(`
					UPDATE subscribers
					SET consent_at = CURRENT_TIMESTAMP, consent_version = ?,
						confirmation_token_hash = ?, confirmation_expires_at = ?
					WHERE id = ? AND status = 'pending'
				`)
				.bind(input.consentVersion, input.tokenHash, input.expiresAt, row.id)
				.run();
			return { subscriberId: row.id, shouldSend: true };
		}
	}
	return {
		subscriberId: row.id,
		shouldSend: row.status === 'pending' && row.confirmation_token_hash === input.tokenHash,
	};
}

export async function beginEmailDelivery(db: D1Database, subscriberId: string) {
	const id = crypto.randomUUID();
	await db
		.prepare("INSERT INTO email_deliveries (id, subscriber_id, status) VALUES (?, ?, 'submitting')")
		.bind(id, subscriberId)
		.run();
	return id;
}

export async function markEmailDeliveryProcessing(db: D1Database, deliveryId: string, messageId: string) {
	await db
		.prepare(`
			UPDATE email_deliveries
			SET message_id = ?, status = 'processing', updated_at = CURRENT_TIMESTAMP
			WHERE id = ?
		`)
		.bind(messageId, deliveryId)
		.run();
}

export async function markEmailDeliverySubmissionFailed(db: D1Database, deliveryId: string, detail: string) {
	await db
		.prepare(`
			UPDATE email_deliveries
			SET status = 'failed', terminal = 1, detail = ?, updated_at = CURRENT_TIMESTAMP
			WHERE id = ?
		`)
		.bind(detail.slice(0, 500), deliveryId)
		.run();
}

export async function applyEmailDeliveryEvent(db: D1Database, event: EmailDeliveryUpdate) {
	const delivery = await db
		.prepare('SELECT id FROM email_deliveries WHERE message_id = ?')
		.bind(event.messageId)
		.first<{ id: string }>();
	if (!delivery) return false;

	await db
		.prepare(`
			UPDATE email_deliveries
			SET status = ?, terminal = ?, provider = ?, smtp_status_code = ?, detail = ?,
				event_at = ?, updated_at = CURRENT_TIMESTAMP
			WHERE id = ? AND (event_at IS NULL OR event_at <= ?)
		`)
		.bind(
			event.status,
			event.terminal ? 1 : 0,
			event.provider,
			event.smtpStatusCode,
			event.detail,
			event.eventAt,
			delivery.id,
			event.eventAt,
		)
		.run();
	return true;
}

export async function getEmailDeliveryAlerts(db: D1Database, limit = 20) {
	const result = await db
		.prepare(`
			WITH ranked_deliveries AS (
				SELECT d.*,
					ROW_NUMBER() OVER (PARTITION BY d.subscriber_id ORDER BY d.created_at DESC, d.id DESC) AS row_number
				FROM email_deliveries d
			)
			SELECT d.id AS delivery_id, s.email, w.name AS list_name, w.slug AS list_slug,
				d.status, d.detail, d.smtp_status_code, d.updated_at
			FROM ranked_deliveries d
			JOIN subscribers s ON s.id = d.subscriber_id
			JOIN waiting_lists w ON w.id = s.list_id
			WHERE d.row_number = 1
				AND d.status IN ('bounced', 'failed', 'rejected', 'complained')
				AND (s.status = 'pending' OR d.status = 'complained')
			ORDER BY d.updated_at DESC
			LIMIT ?
		`)
		.bind(limit)
		.all<EmailDeliveryAlert>();
	return result.results;
}

export async function confirmSubscriber(db: D1Database, tokenHash: string, now: number, country: string | null) {
	return db
		.prepare(`
			UPDATE subscribers
			SET status = 'confirmed', confirmed_at = CURRENT_TIMESTAMP,
				confirmed_country = ?,
				confirmation_token_hash = NULL, confirmation_expires_at = NULL
			WHERE status = 'pending' AND confirmation_token_hash = ? AND confirmation_expires_at >= ?
			RETURNING id, list_id, email
		`)
		.bind(country, tokenHash, now)
		.first<{ id: string; list_id: string; email: string }>();
}

export async function purgeExpiredPending(db: D1Database, now: number) {
	return db.batch([
		db.prepare("DELETE FROM subscribers WHERE status = 'pending' AND confirmation_expires_at < ?").bind(now),
		db
			.prepare("DELETE FROM subscribers WHERE status = 'confirmed' AND confirmed_at < datetime(?, 'unixepoch', '-24 months')")
			.bind(now),
	]);
}

export async function deleteSubscriberById(db: D1Database, subscriberId: string) {
	return db.prepare('DELETE FROM subscribers WHERE id = ?').bind(subscriberId).run();
}

export async function getSubscriberListSlug(db: D1Database, subscriberId: string) {
	return db
		.prepare(`
			SELECT w.slug FROM subscribers s
			JOIN waiting_lists w ON w.id = s.list_id
			WHERE s.id = ?
		`)
		.bind(subscriberId)
		.first<{ slug: string }>();
}

export async function renewPendingSubscriberConfirmation(
	db: D1Database,
	input: { subscriberId: string; tokenHash: string; expiresAt: number },
) {
	const subscriber = await db
		.prepare(`
			SELECT s.id, s.email, w.name AS list_name, w.slug AS list_slug
			FROM subscribers s
			JOIN waiting_lists w ON w.id = s.list_id
			WHERE s.id = ? AND s.status = 'pending'
		`)
		.bind(input.subscriberId)
		.first<{ id: string; email: string; list_name: string; list_slug: string }>();
	if (!subscriber) return null;

	const result = await db
		.prepare(`
			UPDATE subscribers
			SET confirmation_token_hash = ?, confirmation_expires_at = ?
			WHERE id = ? AND status = 'pending'
		`)
		.bind(input.tokenHash, input.expiresAt, input.subscriberId)
		.run();
	return result.meta.changes === 1 ? subscriber : null;
}

export async function getSubscribers(db: D1Database, listId: string, page: number, pageSize = 100) {
	const offset = Math.max(0, page - 1) * pageSize;
	const [subscriberRows, countRow] = await Promise.all([
		db
			.prepare(`
				WITH ranked_deliveries AS (
					SELECT d.subscriber_id, d.status, d.detail, d.updated_at,
						ROW_NUMBER() OVER (PARTITION BY d.subscriber_id ORDER BY d.created_at DESC, d.id DESC) AS row_number
					FROM email_deliveries d
				)
				SELECT s.id, s.email, s.status, s.created_at, s.confirmed_at, s.confirmed_country,
					s.consent_at, s.consent_version,
					CASE
						WHEN s.status = 'confirmed' AND d.status IN ('submitting', 'processing', 'deferred')
						THEN 'delivered'
						ELSE d.status
					END AS email_delivery_status,
					CASE
						WHEN s.status = 'confirmed' AND d.status IN ('submitting', 'processing', 'deferred')
						THEN 'Recipient confirmed through the emailed link.'
						ELSE d.detail
					END AS email_delivery_detail,
					d.updated_at AS email_delivery_updated_at
				FROM subscribers s
				LEFT JOIN ranked_deliveries d ON d.subscriber_id = s.id AND d.row_number = 1
				WHERE s.list_id = ?
				ORDER BY s.created_at DESC, s.id DESC LIMIT ? OFFSET ?
			`)
			.bind(listId, pageSize, offset)
			.all<Subscriber>(),
		db
			.prepare(`
				SELECT COUNT(*) AS total,
					SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) AS confirmed_total,
					SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending_total
				FROM subscribers WHERE list_id = ?
			`)
			.bind(listId)
			.first<{ total: number; confirmed_total: number; pending_total: number }>(),
	]);
	return {
		subscribers: subscriberRows.results,
		total: Number(countRow?.total ?? 0),
		confirmedTotal: Number(countRow?.confirmed_total ?? 0),
		pendingTotal: Number(countRow?.pending_total ?? 0),
	};
}

export async function getSubscriberBatch(
	db: D1Database,
	listId: string,
	limit: number,
	cursor?: { createdAt: string; id: string },
) {
	if (!cursor) {
		const result = await db
			.prepare("SELECT id, email, status, created_at, confirmed_at, confirmed_country, consent_at, consent_version FROM subscribers WHERE list_id = ? AND status = 'confirmed' ORDER BY created_at DESC, id DESC LIMIT ?")
			.bind(listId, limit)
			.all<Subscriber>();
		return result.results;
	}

	const result = await db
		.prepare(`
			SELECT id, email, status, created_at, confirmed_at, confirmed_country, consent_at, consent_version FROM subscribers
			WHERE list_id = ? AND status = 'confirmed' AND (created_at < ? OR (created_at = ? AND id < ?))
			ORDER BY created_at DESC, id DESC LIMIT ?
		`)
		.bind(listId, cursor.createdAt, cursor.createdAt, cursor.id, limit)
		.all<Subscriber>();
	return result.results;
}
