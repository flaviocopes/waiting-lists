import { z } from 'zod';

const emailSchema = z.preprocess(
	(value) => (typeof value === 'string' ? value.trim().toLowerCase() : value),
	z.email().max(254),
);

const slugSchema = z
	.string()
	.trim()
	.toLowerCase()
	.min(2)
	.max(50)
	.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

export function parseEmail(value: unknown): string | null {
	const result = emailSchema.safeParse(value);
	return result.success ? result.data : null;
}

export function parseWaitingListDetails(input: Record<string, unknown>) {
	const name = z.string().trim().min(2).max(80).safeParse(input.name);
	const slug = slugSchema.safeParse(input.slug);
	const originsValue = z.string().trim().max(1000).safeParse(input.allowed_origins ?? '*');

	if (!name.success || !slug.success || !originsValue.success) return null;

	const origins = originsValue.data || '*';
	if (origins !== '*') {
		const parsed = origins
			.split(',')
			.map((origin) => origin.trim())
			.filter(Boolean);
		if (parsed.length === 0 || parsed.length > 20) return null;
		for (const origin of parsed) {
			try {
				const url = new URL(origin);
				if (url.origin !== origin || !['https:', 'http:'].includes(url.protocol)) return null;
			} catch {
				return null;
			}
		}
	}

	return { name: name.data, slug: slug.data, allowedOrigins: origins };
}

export function parseApiKeyName(value: unknown): string | null {
	const result = z.string().trim().min(2).max(80).safeParse(value);
	return result.success ? result.data : null;
}

export function parseAdminUsername(value: unknown): string | null {
	const result = z
		.string()
		.trim()
		.min(2)
		.max(50)
		.regex(/^[A-Za-z0-9._-]+$/)
		.safeParse(value);
	return result.success ? result.data : null;
}

export function parseAdminPassword(value: unknown): string | null {
	const result = z.string().min(12).max(300).safeParse(value);
	return result.success ? result.data : null;
}

export function csvCell(value: string): string {
	return `"${value.replaceAll('"', '""')}"`;
}
