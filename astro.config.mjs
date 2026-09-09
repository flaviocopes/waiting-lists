// @ts-check
import { defineConfig, sessionDrivers } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

export default defineConfig({
	site: process.env.SITE_URL ?? 'http://localhost:4321',
	output: 'server',
	// Collection endpoints enforce each list's origin allowlist. Astro's global
	// same-origin form check must be disabled so approved external sites can POST.
	security: {
		checkOrigin: false,
	},
	adapter: cloudflare({
		imageService: 'compile',
	}),
	// Astro's session API is unused; authentication is stored in D1.
	session: {
		driver: sessionDrivers.lruCache({ max: 1 }),
	},
});
