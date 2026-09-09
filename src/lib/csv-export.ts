import { getCountryName } from './country';
import type { Subscriber } from './db';
import { csvCell } from './validation';

export type CsvExportFormat = 'archive' | 'universal' | 'sendy' | 'kit' | 'mailchimp';

export const CSV_EXPORT_FORMATS: ReadonlyArray<{ value: CsvExportFormat; label: string }> = [
	{ value: 'archive', label: 'Full archive' },
	{ value: 'universal', label: 'Email only (universal)' },
	{ value: 'sendy', label: 'Sendy' },
	{ value: 'kit', label: 'Kit' },
	{ value: 'mailchimp', label: 'Mailchimp' },
];

type ExportSubscriber = Pick<
	Subscriber,
	'email' | 'confirmed_country' | 'confirmed_at' | 'consent_at' | 'consent_version'
>;

export function parseCsvExportFormat(value: string | null): CsvExportFormat | null {
	switch (value) {
		case null:
		case '':
		case 'archive':
			return 'archive';
		case 'universal':
		case 'sendy':
		case 'kit':
		case 'mailchimp':
			return value;
		default:
			return null;
	}
}

export function csvExportHeader(format: CsvExportFormat): string {
	switch (format) {
		case 'archive':
			return '\uFEFFemail,country,confirmed_at,consent_at,consent_version\r\n';
		case 'universal':
			return 'email\r\n';
		case 'sendy':
			return 'Name,Email\r\n';
		case 'kit':
			return 'Email address\r\n';
		case 'mailchimp':
			return 'Email Address,OPTIN_TIME,CONFIRM_TIME\r\n';
	}
}

export function csvExportRow(format: CsvExportFormat, subscriber: ExportSubscriber): string {
	switch (format) {
		case 'archive':
			return [
				subscriber.email,
				getCountryName(subscriber.confirmed_country) ?? '',
				subscriber.confirmed_at ?? '',
				subscriber.consent_at ?? '',
				subscriber.consent_version ?? '',
			].map(csvCell).join(',') + '\r\n';
		case 'universal':
		case 'kit':
			return `${csvCell(subscriber.email)}\r\n`;
		case 'sendy':
			return `${csvCell('')},${csvCell(subscriber.email)}\r\n`;
		case 'mailchimp':
			return [subscriber.email, subscriber.consent_at ?? '', subscriber.confirmed_at ?? '']
				.map(csvCell)
				.join(',') + '\r\n';
	}
}

export function csvExportFilename(slug: string, format: CsvExportFormat): string {
	return format === 'archive' ? `${slug}-subscribers.csv` : `${slug}-${format}.csv`;
}
