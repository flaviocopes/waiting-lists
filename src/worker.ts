import { handle } from '@astrojs/cloudflare/handler';
import { purgeExpiredPending } from './lib/db';
import { consumeEmailDeliveryEvents } from './lib/email-events';

export default {
	fetch(request, env, ctx) {
		return handle(request, env, ctx);
	},
	async scheduled(_controller, env) {
		await purgeExpiredPending(env.DB, Math.floor(Date.now() / 1000));
	},
	queue(batch, env) {
		return consumeEmailDeliveryEvents(batch, env);
	},
} satisfies ExportedHandler<Env, unknown>;
