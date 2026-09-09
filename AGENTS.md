# Agent guide for Waiting Lists

## Objective

Help the owner set up, run, customize, or port this waiting-list service without weakening consent, privacy, authentication, or data-retention behavior.

## Start here

1. Read `README.md`. All project documentation lives there: start with the Human quick start, then the Command-line client, Architecture, Configuration, Security, and Changelog sections.
2. Treat the repository root as the application root.
3. Ask which domain, sender address, Cloudflare account, and deployment target the owner controls before configuring production.
4. Never invent, expose, or commit secrets, production IDs, subscriber records, or personal paths.

## Local setup

```sh
npm ci
cp .dev.vars.example .dev.vars
npm run db:migrate:local
npm run check
npm test
npm run dev
```

Populate `.dev.vars` locally, never in Git. Use different random values for the session and subscriber-token secrets.

## Working rules

- Keep the public collection contract email-only: `email` plus explicit `consent`.
- Preserve generic accepted responses so the endpoint does not reveal whether an address exists.
- Preserve double opt-in, 24-hour confirmation expiry, single-use tokens, removal links, and finite retention unless the owner knowingly changes that policy and its legal copy.
- Keep authentication, CSRF, same-origin checks, rate limiting, secure cookies, Turnstile verification, API-key hashing, and origin allowlists server-enforced.
- Update D1 migrations and tests together when changing stored data.
- Update the privacy notice and consent language when data collection, processors, purpose, or retention changes.
- Do not enable remote email, analytics, queues, or deployment until owner-controlled settings are present.
- Treat infrastructure and framework choices as replaceable. Preserve user-visible behavior and security invariants when porting.
- Treat `1.0.0` as the initial public release. For every later release, update the package version, lockfile, tests, and the Changelog section of `README.md` together.

## Verification before handoff

```sh
npm run check
npm test
npm run build
```

For production work, also apply migrations to a non-production environment and exercise login, list creation, cross-origin subscription, confirmation, removal, exports, API-key revocation, Queue delivery events, and scheduled cleanup.

## Useful task prompts

- “Set this repository up locally and stop before creating cloud resources.”
- “Use the included CLI to create a list for this project and connect its signup form.”
- “Use the included CLI to show the linked list and export confirmed subscribers.”
- “Configure a new Cloudflare deployment using only resources in my account.”
- “Rebrand the interface and update every legal and email reference consistently.”
- “Port this to Next.js and PostgreSQL while preserving the documented product and security contract.”
- “Replace Cloudflare Email Service with my provider and update tests and deployment docs.”
