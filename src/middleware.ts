import { defineMiddleware } from 'astro:middleware';

export const onRequest = defineMiddleware(async ({ request }, next) => {
	const url = new URL(request.url);
	const original = await next();
	const response = new Response(original.body, original);
	const path = url.pathname;
	const turnstileSources = path === '/login' ? ' https://challenges.cloudflare.com' : '';

	response.headers.set(
		'Content-Security-Policy',
		`default-src 'self'; base-uri 'none'; connect-src 'self'; font-src 'self'; form-action 'self'; frame-ancestors 'none'; frame-src 'self'${turnstileSources}; img-src 'self' data:; object-src 'none'; script-src 'self'${turnstileSources}; style-src 'self' 'unsafe-inline'; upgrade-insecure-requests`,
	);
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('X-Frame-Options', 'DENY');
	response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
	response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
	response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

	if (path.startsWith('/admin') || path.startsWith('/api/v1/') || path === '/login' || path === '/confirm' || path === '/remove') {
		response.headers.set('Cache-Control', 'no-store, max-age=0');
		response.headers.set('X-Robots-Tag', 'noindex, nofollow');
	}
	if (path === '/confirm' || path === '/remove') response.headers.set('Referrer-Policy', 'no-referrer');

	return response;
});
