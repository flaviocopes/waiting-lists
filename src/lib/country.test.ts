import { describe, expect, it } from 'vitest';
import { getCountryName, normalizeCountryCode } from './country';

describe('confirmation country', () => {
	it('normalizes an ISO-style two-letter country code', () => {
		expect(normalizeCountryCode('dk')).toBe('DK');
	});

	it('omits unknown, Tor, and malformed values', () => {
		expect(normalizeCountryCode(undefined)).toBeNull();
		expect(normalizeCountryCode('XX')).toBeNull();
		expect(normalizeCountryCode('T1')).toBeNull();
		expect(normalizeCountryCode('DNK')).toBeNull();
	});

	it('renders stored codes as English country names', () => {
		expect(getCountryName('DK')).toBe('Denmark');
		expect(getCountryName('US')).toBe('United States');
		expect(getCountryName(null)).toBeNull();
	});
});
