#!/usr/bin/env node

import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import process from 'node:process';

const DEFAULT_API_URL = 'http://localhost:4321/api/v1';
const CONFIG_PATH = process.env.WAITINGLISTS_CONFIG || join(homedir(), '.config', 'waitinglists', 'credentials.json');
const PROJECT_PATH = resolve(process.cwd(), '.waitinglists.json');

function parseArguments(values) {
	const positional = [];
	const flags = {};
	for (let index = 0; index < values.length; index += 1) {
		const value = values[index];
		if (!value.startsWith('--')) {
			positional.push(value);
			continue;
		}
		const name = value.slice(2);
		const next = values[index + 1];
		if (!next || next.startsWith('--')) flags[name] = true;
		else {
			flags[name] = next;
			index += 1;
		}
	}
	return { positional, flags };
}

async function readJson(path) {
	try {
		return JSON.parse(await readFile(path, 'utf8'));
	} catch (error) {
		if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') return null;
		throw error;
	}
}

async function readStdin() {
	let value = '';
	for await (const chunk of process.stdin) value += chunk;
	return value;
}

function slugify(value) {
	return value
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '')
		.slice(0, 50);
}

async function credentials() {
	const stored = await readJson(CONFIG_PATH);
	const apiKey = process.env.WAITINGLISTS_API_KEY || stored?.apiKey;
	const apiUrl = (process.env.WAITINGLISTS_API_URL || stored?.apiUrl || DEFAULT_API_URL).replace(/\/$/, '');
	if (!apiKey) {
		throw new Error('No API key configured. Run `waitinglists configure --key-stdin` or set WAITINGLISTS_API_KEY.');
	}
	return { apiKey, apiUrl };
}

async function apiRequest(path, init = {}) {
	const { apiKey, apiUrl } = await credentials();
	const headers = new Headers(init.headers);
	headers.set('Authorization', `Bearer ${apiKey}`);
	if (init.body) headers.set('Content-Type', 'application/json');
	const response = await fetch(`${apiUrl}${path}`, { ...init, headers });
	if (!response.ok) {
		let message = `${response.status} ${response.statusText}`;
		try {
			const payload = await response.json();
			message = payload?.error?.message || message;
		} catch {
			// Keep the HTTP status when the server did not return JSON.
		}
		throw new Error(message);
	}
	return response;
}

async function apiJson(path, init) {
	const response = await apiRequest(path, init);
	return response.json();
}

async function linkedListId(explicitId) {
	if (explicitId) return explicitId;
	const project = await readJson(PROJECT_PATH);
	if (!project?.listId) throw new Error('No list ID supplied and this directory is not linked. Run `waitinglists init`.');
	return project.listId;
}

function print(value, asJson = false) {
	if (asJson || typeof value !== 'string') console.log(JSON.stringify(value, null, 2));
	else console.log(value);
}

function help() {
	console.log(`waitinglists — private agent CLI

Usage:
  waitinglists configure --key-stdin [--api-url URL]
  waitinglists init --name NAME --origin URL [--slug SLUG] [--json]
  waitinglists create --name NAME --origin URL [--slug SLUG] [--json]
  waitinglists lists [--json]
  waitinglists show [LIST_ID] [--json]
  waitinglists update [LIST_ID] [--name NAME] [--slug SLUG] [--origin URL] [--json]
  waitinglists integration [LIST_ID] [--json]
  waitinglists export [LIST_ID] [--format archive|universal|sendy|kit|mailchimp] --output FILE

Environment:
  WAITINGLISTS_API_KEY   Use a key without saving it locally.
  WAITINGLISTS_API_URL   Override the API base URL for local testing.
  WAITINGLISTS_CONFIG    Override the credentials file path.`);
}

async function configure(flags) {
	let apiKey = typeof flags.key === 'string' ? flags.key : '';
	if (flags['key-stdin']) apiKey = (await readStdin()).trim();
	if (!apiKey.startsWith('wl_live_')) throw new Error('Provide a Waiting Lists key with --key-stdin or --key.');
	const apiUrl = typeof flags['api-url'] === 'string' ? flags['api-url'].replace(/\/$/, '') : DEFAULT_API_URL;
	await mkdir(dirname(CONFIG_PATH), { recursive: true });
	await writeFile(CONFIG_PATH, `${JSON.stringify({ apiUrl, apiKey }, null, 2)}\n`, { mode: 0o600 });
	await chmod(CONFIG_PATH, 0o600);
	console.log(`Credentials saved to ${CONFIG_PATH}`);
}

function listInput(flags) {
	const name = typeof flags.name === 'string' ? flags.name.trim() : '';
	const slug = typeof flags.slug === 'string' ? flags.slug : slugify(name);
	const allowedOrigins = typeof flags.origin === 'string' ? flags.origin : '';
	if (!name || !slug || !allowedOrigins) throw new Error('Provide --name and --origin. The slug is generated when omitted.');
	return { name, slug, allowed_origins: allowedOrigins };
}

async function createList(flags) {
	const payload = await apiJson('/lists', { method: 'POST', body: JSON.stringify(listInput(flags)) });
	return payload.data;
}

async function run() {
	const [command = 'help', ...values] = process.argv.slice(2);
	const { positional, flags } = parseArguments(values);
	const asJson = flags.json === true;

	if (command === 'help' || command === '--help' || command === '-h') return help();
	if (command === 'configure') return configure(flags);
	if (command === 'init') {
		if (await readJson(PROJECT_PATH)) {
			throw new Error(`This directory is already linked in ${PROJECT_PATH}. Use \`waitinglists create\` for another list.`);
		}
		const list = await createList(flags);
		const project = {
			listId: list.id,
			slug: list.slug,
			endpoint: list.integration.endpoint,
		};
		await writeFile(PROJECT_PATH, `${JSON.stringify(project, null, 2)}\n`);
		if (asJson) return print({ ...list, project_file: PROJECT_PATH }, true);
		console.log(`Created ${list.name}`);
		console.log(`Endpoint: ${list.integration.endpoint}`);
		console.log(`Linked: ${PROJECT_PATH}`);
		return;
	}
	if (command === 'create') {
		const list = await createList(flags);
		return print(asJson ? list : `Created ${list.name}\nID: ${list.id}\nEndpoint: ${list.integration.endpoint}`, asJson);
	}
	if (command === 'lists') {
		const payload = await apiJson('/lists');
		if (asJson) return print(payload.data, true);
		if (payload.data.length === 0) return console.log('No waiting lists.');
		for (const list of payload.data) console.log(`${list.id}\t${list.name}\t${list.subscriber_count} confirmed\t${list.endpoint}`);
		return;
	}
	if (command === 'show') {
		const id = await linkedListId(positional[0]);
		const payload = await apiJson(`/lists/${encodeURIComponent(id)}`);
		return print(payload.data, true);
	}
	if (command === 'update') {
		const id = await linkedListId(positional[0]);
		const body = {};
		if (typeof flags.name === 'string') body.name = flags.name;
		if (typeof flags.slug === 'string') body.slug = flags.slug;
		if (typeof flags.origin === 'string') body.allowed_origins = flags.origin;
		if (Object.keys(body).length === 0) throw new Error('Provide --name, --slug, or --origin.');
		const payload = await apiJson(`/lists/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(body) });
		return print(asJson ? payload.data : `Updated ${payload.data.name}`, asJson);
	}
	if (command === 'integration') {
		const id = await linkedListId(positional[0]);
		const payload = await apiJson(`/lists/${encodeURIComponent(id)}/integration`);
		if (asJson) return print(payload.data, true);
		console.log(`Endpoint: ${payload.data.endpoint}\n\n${payload.data.html}`);
		return;
	}
	if (command === 'export') {
		const id = await linkedListId(positional[0]);
		const format = typeof flags.format === 'string' ? flags.format : 'archive';
		if (typeof flags.output !== 'string') throw new Error('Provide --output FILE. Subscriber data is never printed to stdout.');
		const response = await apiRequest(`/lists/${encodeURIComponent(id)}/export?format=${encodeURIComponent(format)}`);
		const destination = resolve(process.cwd(), flags.output);
		await writeFile(destination, new Uint8Array(await response.arrayBuffer()), { flag: 'wx', mode: 0o600 });
		console.log(`Export saved to ${destination}`);
		return;
	}

	throw new Error(`Unknown command: ${command}. Run \`waitinglists help\`.`);
}

run().catch((error) => {
	console.error(`waitinglists: ${error instanceof Error ? error.message : String(error)}`);
	process.exitCode = 1;
});
