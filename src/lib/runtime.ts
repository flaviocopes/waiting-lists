import { env } from 'cloudflare:workers';

export type AppBindings = Env;

export function getBindings(): AppBindings {
	return env;
}
