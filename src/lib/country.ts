const COUNTRY_CODE_PATTERN = /^[A-Z]{2}$/;
const COUNTRY_NAMES = new Intl.DisplayNames(['en'], { type: 'region' });

export function normalizeCountryCode(value: unknown): string | null {
	if (typeof value !== 'string') return null;
	const country = value.trim().toUpperCase();
	if (!COUNTRY_CODE_PATTERN.test(country) || country === 'XX') return null;
	return country;
}

export function getConfirmationCountry(request: Request): string | null {
	return normalizeCountryCode(request.cf?.country);
}

export function getCountryName(value: unknown): string | null {
	const country = normalizeCountryCode(value);
	if (!country) return null;
	return COUNTRY_NAMES.of(country) ?? country;
}
