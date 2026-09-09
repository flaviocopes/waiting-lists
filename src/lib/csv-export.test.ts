import { describe, expect, it } from 'vitest';
import {
	csvExportFilename,
	csvExportHeader,
	csvExportRow,
	parseCsvExportFormat,
	type CsvExportFormat,
} from './csv-export';

const subscriber = {
	email: 'person@example.com',
	confirmed_country: 'DK',
	confirmed_at: '2026-07-30 18:00:00',
	consent_at: '2026-07-30 17:55:00',
	consent_version: '2026-07-30-v2',
};

describe('CSV export formats', () => {
	it('defaults to the full archive and rejects unsupported formats', () => {
		expect(parseCsvExportFormat(null)).toBe('archive');
		expect(parseCsvExportFormat('kit')).toBe('kit');
		expect(parseCsvExportFormat('other')).toBeNull();
	});

	it.each<[CsvExportFormat, string, string]>([
		['archive', '\uFEFFemail,country,confirmed_at,consent_at,consent_version\r\n', '"person@example.com","Denmark","2026-07-30 18:00:00","2026-07-30 17:55:00","2026-07-30-v2"\r\n'],
		['universal', 'email\r\n', '"person@example.com"\r\n'],
		['sendy', 'Name,Email\r\n', '"","person@example.com"\r\n'],
		['kit', 'Email address\r\n', '"person@example.com"\r\n'],
		['mailchimp', 'Email Address,OPTIN_TIME,CONFIRM_TIME\r\n', '"person@example.com","2026-07-30 17:55:00","2026-07-30 18:00:00"\r\n'],
	])('renders the %s preset', (format, header, row) => {
		expect(csvExportHeader(format)).toBe(header);
		expect(csvExportRow(format, subscriber)).toBe(row);
	});

	it('uses a format-specific filename', () => {
		expect(csvExportFilename('product', 'archive')).toBe('product-subscribers.csv');
		expect(csvExportFilename('product', 'mailchimp')).toBe('product-mailchimp.csv');
	});
});
