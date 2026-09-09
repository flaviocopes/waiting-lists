# Waiting Lists

This is one of the software packages I publish with full source code. The landing page is at https://flaviocopes.com/software/waiting-lists/.

It is MIT licensed. You are free to use it, fork it and change it, also for commercial work.

There is no support. Issues, pull requests, discussions, and the wiki are turned off, and there is no roadmap. Forks are welcome.

If you point a coding agent at this repository, tell it to read `AGENTS.md` first.

Waiting Lists is a self-hosted, email-only waiting-list service with double opt-in, a private dashboard, an agent-ready API and CLI, CSV exports, and privacy-minded retention controls.

Current release: **1.0** (`1.0.0` in package metadata). See the [Changelog](#changelog) for release notes.

Live credentials, account identifiers, analytics, deployment history, dependencies, and build output are intentionally excluded from this repository.

## Table of contents

- [What is included](#what-is-included)
- [Human quick start](#human-quick-start)
- [Project map](#project-map)
- [Change the stack](#change-the-stack)
- [Collect an email](#collect-an-email)
- [Admin](#admin)
- [Privacy operations](#privacy-operations)
- [Cloudflare Email Service](#cloudflare-email-service)
- [Local development](#local-development)
- [Verify and deploy](#verify-and-deploy)
- [Command-line client](#command-line-client)
- [Architecture](#architecture)
- [How it was built](#how-it-was-built)
- [Configuration](#configuration)
- [Deployment](#deployment)
- [Customization](#customization)
- [Security](#security)
- [Decisions](#decisions)
- [Changelog](#changelog)

## What is included

- Complete Astro and TypeScript source at the repository root
- Cloudflare Worker, D1 migrations, Queue consumer, Cron cleanup, rate limits, Turnstile, and Email Service integration
- Admin authentication, waiting-list management, delivery status, and CSV exports
- Public HTML/JSON subscription endpoint with per-list origin controls
- Private JSON API and complete command-line client for terminal use, AI agents, and automation
- A dedicated [Command-line client](#command-line-client) guide with setup, command reference, common workflows, and credential handling
- Automated tests for authentication, API keys, consent tokens, CSV, email events, country data, Turnstile, and validation
- Human setup instructions here and dedicated instructions for AI coding agents in `AGENTS.md`

## Human quick start

### 1. Prerequisites

Install Node.js 22 or newer. Create a Cloudflare account if you want to use the included deployment path.

### 2. Install and verify

```sh
npm ci
npm run check
npm test
```

### 3. Create local settings

```sh
cp .dev.vars.example .dev.vars
```

Replace every placeholder in `.dev.vars`. Generate separate random values for `SESSION_SECRET` and `SUBSCRIBER_TOKEN_SECRET`. Generate `ADMIN_PASSWORD_HASH` from a strong password:

```sh
printf %s 'your-high-entropy-password' | openssl dgst -sha256
```

### 4. Prepare the local database

```sh
npm run db:migrate:local
npm run dev
```

Open the local URL shown by Astro, then visit `/login` and sign in with the administrator credentials from `.dev.vars`.

### 5. Create and connect a list

Create a waiting list in the dashboard. Add the exact browser origins that may submit to it. The list page generates ready-to-copy HTML, JavaScript, and an AI-agent integration brief.

### 6. Use the included CLI

Create an API key at `/admin/agent`, then follow the [Command-line client](#command-line-client) section to configure the command-line client without putting the key in shell history.

```sh
npm run waitinglists -- help
npm run waitinglists -- init --name "My product" --origin "https://example.com"
```

The CLI can create, list, inspect, update, integrate, and export waiting lists. It runs from `cli/waitinglists.mjs` and uses the private API included in this repository.

Before deploying, continue with [Configuration](#configuration), [Security](#security), and [Deployment](#deployment).

## Project map

- `src/pages/`: public, admin, and API routes
- `src/lib/`: auth, database, consent, email, API keys, validation, and exports
- `src/worker.ts`: Worker entry, Queue consumer, and scheduled cleanup
- `migrations/`: D1 schema history
- `cli/`: complete command-line client for people, coding agents, and automation
- `wrangler.jsonc`: portable Cloudflare configuration with placeholders

## Change the stack

The included Astro and Cloudflare implementation is a working reference, not a lock-in contract. The behavior, data model, edge cases, and tests are the blueprint. You can ask an AI coding agent to move the UI, database, email provider, framework, or deployment platform while preserving the product contract described in this document.

Read `AGENTS.md` first when handing this repository to an AI coding agent.

## Collect an email

The app is a minimal-data, double-opt-in waiting-list service built with Astro and deployed as a Cloudflare Worker. It uses D1 for waiting lists, consent records, and short-lived admin sessions, and Cloudflare Email Service for transactional confirmation messages.

Create a list in the admin dashboard, then POST an `email` and the visitor's explicit `consent` to its endpoint. Consent is required and the email is the only subscriber-supplied personal data. At confirmation, the Worker stores Cloudflare's approximate two-letter country code without retaining the underlying IP address.

```html
<form
  method="post"
  action="https://your-domain.example/api/subscribe/my-list"
>
  <input type="email" name="email" required />
  <label>
    <input type="checkbox" name="consent" value="yes" required />
    I want updates about this waitlist and agree to the privacy notice.
  </label>
  <button>Join the waitlist</button>
</form>
```

JSON requests are also supported:

```js
await fetch(
  "https://your-domain.example/api/subscribe/my-list",
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "person@example.com", consent: true }),
  },
);
```

When creating a list, set its allowed browser origins to a comma-separated list such as `https://example.com, https://www.example.com`. Use `*` only for a deliberately public endpoint. The submitting page must show clear, specific consent text and link to an applicable privacy notice before it posts.

The endpoint returns the same generic accepted response for new and already-confirmed addresses and does not claim that an email has been delivered. New requests remain pending until the owner clicks the email link and then presses the confirmation button. The second step avoids automatic confirmation by email security scanners. Links expire after 24 hours.

## Admin

The dashboard is at `/login`. Credentials and session signing material are Cloudflare Worker secrets:

- `ADMIN_USERNAME`
- `ADMIN_PASSWORD_HASH`: lowercase SHA-256 hex of a high-entropy password
- `SESSION_SECRET`: at least 32 random bytes
- `SUBSCRIBER_TOKEN_SECRET`: a different, at least 32-byte secret for confirmation and removal links

The private area uses edge rate limiting, Cloudflare Turnstile with canonical server-side Siteverify, server-side session checks, HMAC-protected random session tokens, secure HTTP-only cookies, same-origin checks, and per-session CSRF tokens. Turnstile verification fails closed and checks both the `login` action and a production hostname allowlist. Confirmation tokens are random, stored only as keyed hashes, expire after 24 hours, and are single-use. Admin exports include confirmed addresses only.

CSV exports include the complete consent archive, an email-only universal file, and import-ready presets for Sendy, Kit, and Mailchimp. The Mailchimp preset carries the original request and confirmation timestamps as `OPTIN_TIME` and `CONFIRM_TIME`.

Each waiting-list detail page includes editable name, endpoint slug, and allowed-origin settings, plus an agent-ready integration brief with exact HTML and JavaScript examples. The public endpoint accepts exactly two fields, `email` and `consent`, and requires the browser origin to match the list configuration.

There is deliberately no public account bootstrap or public key-issuance route. API keys can only be created by the existing administrator at `/admin/agent` and are stored in D1 as SHA-256 hashes.

## Privacy operations

- Pending requests are deleted after expiry by a daily Cron Trigger.
- Confirmed records are deleted after 24 months at the latest, or earlier through a signed self-service removal link or the admin dashboard.
- D1 stores the email, list relationship, status, consent version, request/confirmation timestamps, approximate confirmation country, and minimal confirmation-delivery status. It does not store subscriber IP addresses, user agents, names, or profiles.
- The public site does not set cookies. After a successful signup, it stores only a list-specific joined marker in local browser storage so returning visitors do not see the form again. The admin session cookie is strictly necessary.
- `/privacy` contains the service privacy notice. Each external form still needs purpose-specific consent wording and its own applicable controller information.

This implementation supports GDPR data-minimisation, transparency, consent-evidence, withdrawal, and storage-limitation workflows. Operational compliance also depends on keeping the notice accurate, responding to rights requests, maintaining Cloudflare's Data Processing Addendum, and using exported addresses only for the purpose people accepted.

## Cloudflare Email Service

The Worker uses a restricted `EMAIL` send binding. Replace the example sender with an address on your own domain. Email Sending must be onboarded for the domain before deployment; Cloudflare then manages the sending SPF, DKIM, bounce MX, and DMARC records. A Queue event subscription reports delivery, deferral, bounce, rejection, complaint, and failure outcomes back to the private dashboard. Configure the privacy contact on your domain with Email Routing to a verified destination so rights requests are received.

## Local development

```bash
npm install
cp .dev.vars.example .dev.vars
npm run cf:types
npm run db:migrate:local
npx astro dev --background
```

Generate the local password hash with:

```bash
printf %s 'your-high-entropy-password' | openssl dgst -sha256
```

## Verify and deploy

```bash
npm run check
npm test
git push origin main
```

If you connect your repository to Cloudflare Workers Builds, production deploys automatically from the `main` branch. Cloudflare runs `npm run build`, then `npx wrangler deploy --config dist/server/wrangler.json`. Run `npm run deploy` only as an emergency manual fallback.

Apply new D1 migrations with `npm run db:migrate:remote` before pushing code that depends on them. The D1, rate-limit, Email Service, custom-domain, and Cron Trigger bindings are declared in `wrangler.jsonc`. Never commit `.dev.vars` or plaintext credentials.

## Command-line client

This repository includes a working Waiting Lists CLI in `cli/waitinglists.mjs`. It uses the included private JSON API, so you can manage waiting lists from a terminal or let a coding agent do it through a small, predictable command set.

The CLI runs directly from this repository through the `waitinglists` package script. It is not a separately published npm package and does not require a global install.

### Before you start

1. Install the project and run the database migrations as described in the [Human quick start](#human-quick-start).
2. Start the app locally or deploy it to infrastructure you control.
3. Sign in to the private dashboard and open `/admin/agent`.
4. Create an API key. Copy it when shown because the app stores only its hash.

### Configure the CLI

From the repository root, pass the key through standard input so it does not appear in shell history:

```sh
read -s WAITINGLISTS_API_KEY
printf %s "$WAITINGLISTS_API_KEY" | npm run waitinglists -- configure \
  --key-stdin \
  --api-url https://waiting-lists.example/api/v1
unset WAITINGLISTS_API_KEY
```

On macOS you can also pipe the key from the clipboard:

```sh
pbpaste | npm run waitinglists -- configure --key-stdin
```

For local development, omit `--api-url`. The CLI defaults to `http://localhost:4321/api/v1`.

The CLI saves credentials to `~/.config/waitinglists/credentials.json` with owner-only permissions. You can instead provide `WAITINGLISTS_API_KEY` and `WAITINGLISTS_API_URL` as environment variables.

### Create and link a list

Run this from the website project that will use the waiting list:

```sh
node /path/to/waiting-lists/cli/waitinglists.mjs init \
  --name "My product" \
  --origin "https://example.com"
```

`init` creates the list and writes `.waitinglists.json` in the current directory. This file contains the non-secret list ID, slug, and public collection endpoint. It is safe to commit if your project benefits from sharing that link.

If you run the command from the repository root, use the shorter form:

```sh
npm run waitinglists -- init --name "My product" --origin "https://example.com"
```

### Commands

```text
waitinglists configure --key-stdin [--api-url URL]
waitinglists init --name NAME --origin URL [--slug SLUG] [--json]
waitinglists create --name NAME --origin URL [--slug SLUG] [--json]
waitinglists lists [--json]
waitinglists show [LIST_ID] [--json]
waitinglists update [LIST_ID] [--name NAME] [--slug SLUG] [--origin URL] [--json]
waitinglists integration [LIST_ID] [--json]
waitinglists export [LIST_ID] [--format archive|universal|sendy|kit|mailchimp] --output FILE
```

Use `npm run waitinglists -- help` to print the same reference in the terminal.

Most commands accept a list ID. After `init`, commands run in the linked project can read the ID from `.waitinglists.json` instead.

### Common workflows

List every waiting list:

```sh
npm run waitinglists -- lists
```

Print the linked list and its subscriber summary as JSON:

```sh
npm run waitinglists -- show --json
```

Get the public endpoint and generated form markup:

```sh
npm run waitinglists -- integration
```

Change the allowed browser origin:

```sh
npm run waitinglists -- update --origin "https://www.example.com"
```

Export confirmed subscribers without printing personal data to the terminal:

```sh
npm run waitinglists -- export \
  --format universal \
  --output confirmed-subscribers.csv
```

The export command refuses to overwrite an existing file and creates the new file with owner-only permissions.

### Coding-agent use

Point your coding agent at this repository and ask it to read `AGENTS.md` and this section. The agent can then use `--json` for structured output, create or inspect a list, fetch its integration markup, and connect the public form.

Do not put an API key in `AGENTS.md`, `.waitinglists.json`, prompts, source files, or Git. Configure it once through standard input or expose it to a trusted process through `WAITINGLISTS_API_KEY`.

### Troubleshooting

- `No API key configured` means the credentials file and `WAITINGLISTS_API_KEY` are both missing.
- `401 Unauthorized` means the key is invalid or has been revoked in `/admin/agent`.
- `No list ID supplied` means the current directory has no `.waitinglists.json`; pass a list ID or run `init`.
- Origin errors mean the collecting site's exact browser origin is missing from the list configuration.

## Architecture

### Overview

Waiting Lists is an Astro server-rendered application deployed through a Cloudflare Worker. D1 stores lists, subscribers, consent evidence, admin sessions, API keys, settings, and email delivery events. Cloudflare Email Service sends confirmation messages, a Queue reports delivery outcomes, and a Cron Trigger removes expired or over-retained records.

### Request flow

1. An administrator creates a list and configures allowed browser origins.
2. A public form posts exactly `email` and `consent` to `/api/subscribe/[slug]`.
3. Validation, origin rules, and rate limits run before D1 changes.
4. A pending subscriber and hashed one-time confirmation token are stored.
5. Email Service sends a confirmation link and a separate removal link.
6. The person reviews and confirms; the token is consumed and the subscriber becomes confirmed.
7. The dashboard and exports expose confirmed subscribers to the authenticated administrator.
8. Queue events update delivery status. Scheduled cleanup removes expired pending requests and old confirmed records.

### Main boundaries

- `src/pages/api/subscribe/[slug].ts`: public collection boundary
- `src/pages/admin/`: private human interface
- `src/pages/api/v1/`: private agent/API boundary
- `cli/waitinglists.mjs`: included command-line client for people, coding agents, and automation
- `src/lib/auth.ts`: password, session, cookie, and CSRF rules
- `src/lib/subscriber-tokens.ts`: confirmation and removal token rules
- `src/lib/db.ts`: database queries and lifecycle operations
- `src/lib/email.ts` and `email-events.ts`: outbound mail and delivery events
- `src/lib/integration.ts`: machine-readable integration contract
- `src/worker.ts`: HTTP entry, scheduled cleanup, and Queue consumer
- `migrations/`: source of truth for the D1 schema

### Replaceable infrastructure

Cloudflare is the reference implementation. A port can replace D1 with PostgreSQL, Email Service with another transactional provider, Queues with a job runner, Turnstile with another abuse-control layer, and Workers with any server runtime. Preserve the boundaries and acceptance behavior above rather than translating files line by line.

## How it was built

### Source snapshot

This repository is a public copy of a private production codebase. The public copy removes live resources and analytics, replaces production settings with placeholders, and adds project documentation.

### Install

```sh
npm ci
```

### Static checks and tests

```sh
npm run check
npm test
```

The test suite covers authentication, API parsing and keys, country mapping, CSV exports, email delivery events, subscriber tokens, Turnstile behavior, and validation.

### Production build

```sh
npm run build
```

### Local smoke test

```sh
cp .dev.vars.example .dev.vars
npm run db:migrate:local
npm run dev
```

Use local-only placeholder resources and sample addresses. Confirm that the public page renders, login fails closed without valid settings, the database migration completes, and configured local flows behave as expected.

### After changes

Run checks, tests, and the production build again. When behavior, configuration, schema, privacy, or deployment changes, update the matching sections of this README as part of the same change.

## Configuration

### Local secrets

Copy `.dev.vars.example` to `.dev.vars`. Never commit the resulting file.

- `ADMIN_USERNAME`: private dashboard username
- `ADMIN_PASSWORD_HASH`: lowercase SHA-256 digest of a strong password
- `SESSION_SECRET`: random value of at least 32 bytes
- `SUBSCRIBER_TOKEN_SECRET`: a different random value of at least 32 bytes
- `TURNSTILE_SECRET`: secret from the developer-owned Turnstile widget
- `TURNSTILE_SITE_KEY`: public key for the same widget
- `TURNSTILE_HOSTNAMES`: comma-separated allowed login hostnames

### Wrangler settings

Replace every placeholder in `wrangler.jsonc` before remote deployment:

- Worker name and optional custom-domain routes
- `APP_URL` and `EMAIL_FROM`
- consent-version identifier
- Turnstile site key and production hostnames
- Email Service allowed sender
- D1 database name and ID
- Queue name
- rate-limit namespace IDs when required by your account

Create production secrets with `wrangler secret put`; do not place them in `vars`.

### CLI settings

The included command-line client lives in `cli/waitinglists.mjs` and runs through `npm run waitinglists --`. Read the [Command-line client](#command-line-client) section for API-key setup, the command reference, common workflows, and coding-agent use.

- `WAITINGLISTS_API_URL`: base URL ending in `/api/v1`; defaults to the local development URL
- `WAITINGLISTS_API_KEY`: temporary in-process key override
- `WAITINGLISTS_CONFIG`: optional path for the credentials file

The CLI stores its normal credentials outside the repository with owner-only permissions.

### Legal and operational settings

Replace the sample controller and contact details in the privacy notice. Confirm your consent text, retention period, Cloudflare DPA, sender-domain onboarding, and process for privacy requests before collecting real addresses.

## Deployment

### Cloudflare reference path

1. Complete [Configuration](#configuration) and [Security](#security).
2. Create a D1 database, Queue, Turnstile widget, rate-limit bindings, and Email Service sender in an account you control.
3. Replace the placeholders in `wrangler.jsonc` and add custom-domain routes only after the domain is active.
4. Store `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH`, `SESSION_SECRET`, `SUBSCRIBER_TOKEN_SECRET`, and `TURNSTILE_SECRET` as Worker secrets.
5. Run the checks in [How it was built](#how-it-was-built).
6. Apply D1 migrations remotely with `npm run db:migrate:remote`.
7. Deploy with `npm run deploy` or connect the repository to Cloudflare Workers Builds.

### Later releases

Increment the semantic version and add a dated entry to the [Changelog](#changelog). Keep `package.json`, `package-lock.json`, and this README synchronized.

### Email operations

Onboard a sender domain through Cloudflare Email Service and keep the configured `EMAIL_FROM` address consistent with the allowed sender binding. Configure the Queue event subscription so bounce, complaint, rejection, and delivery outcomes reach the Worker.

### Other platforms

Port the product contract rather than the Cloudflare configuration. You need an SSR/server runtime, SQL storage, transactional email, background delivery events, abuse controls, secure secret storage, and a daily cleanup job. See [Architecture](#architecture) and [Security](#security) for the behavior that must survive the move.

### Post-deploy checks

Verify public signup from an allowed and disallowed origin, confirmation and removal links, admin login/logout, CSRF protection, CSV exports, API-key creation/revocation, email delivery events, scheduled cleanup, security headers, canonical URLs, and mobile layout.

## Customization

### Branding and copy

Search the repository for `waitinglists.dev`, `Waiting Lists`, `privacy@`, and `waitlist@`. Replace product names, domain references, sender identity, page metadata, email copy, consent wording, and the sample privacy controller together.

### Public experience

The marketing and signup page is `src/pages/index.astro`; shared styles are in `src/styles/global.css`. Each list can also collect signups from another site through its generated form or JSON example.

### Data and retention

Change the schema only through a new migration. If you add subscriber fields or change retention, update validation, exports, privacy text, integration examples, cleanup logic, and tests in the same change.

### Email provider

Keep the interface expressed by `src/lib/email.ts` and the delivery-state behavior in `src/lib/email-events.ts`. A replacement provider should preserve confirmation, removal, bounce, complaint, rejection, and failure handling.

### Framework or host

Use [Architecture](#architecture) as the behavior map. Port routes, data rules, security invariants, scheduled cleanup, and tests to the destination stack. The UI framework and cloud primitives can change completely.

### Agent workflow

The private CLI in `cli/waitinglists.mjs` is a useful automation boundary. Keep credentials outside repositories, preserve explicit API-key creation and revocation, and update the generated integration contract when API behavior changes.

## Security

### Secrets and credentials

Keep `.dev.vars`, production secrets, API keys, subscriber data, local Wrangler state, and database files out of Git. Use different random values for session signing and subscriber tokens. Revoke and rotate exposed keys.

### Trust boundaries

- Public collection accepts only validated email and explicit consent.
- Browser origins must match each list's allowlist.
- Admin pages and mutations require a live server-side session.
- Mutations require CSRF and same-origin checks.
- Login and subscription routes are rate limited.
- Turnstile verification checks the expected action and hostname.
- Confirmation, removal, session, and API tokens are hashed or keyed before storage.
- Exports are private and confirmed-only unless an archive format explicitly includes consent evidence.

### Before production

- Replace every placeholder, brand reference, controller identity, and contact address.
- Use owner-controlled D1, Queue, Turnstile, Email Service, DNS, and deployment resources.
- Verify secure cookies and HTTPS on the real hostname.
- Test invalid origins, expired tokens, replay attempts, revoked API keys, CSRF failures, and rate limits.
- Review the privacy notice and retention choices for the intended jurisdiction and use.
- Configure monitoring without logging secrets, confirmation links, or subscriber addresses unnecessarily.

### Porting safely

Do not treat a framework rewrite as a visual-only exercise. Recreate authorization, CSRF, rate limits, generic responses, origin checks, hashed tokens, finite retention, and delivery-event handling before accepting production traffic.

## Decisions

### Email-only subscriber data

The public endpoint accepts only an email and explicit consent. This keeps forms simple and reduces the amount of personal data stored. Add fields only with a clear purpose and matching changes to consent, privacy, exports, retention, schema, and tests.

### Double opt-in

New requests remain pending until the address owner confirms. The confirmation page requires a deliberate second action so automated email scanners do not complete consent accidentally.

### Hashed single-use tokens

Confirmation and API secrets are not stored in reusable plaintext form. Random values are shown or sent once and only keyed hashes remain in D1.

### Generic public responses

The collection endpoint does not reveal whether an email is new, pending, or already confirmed. This reduces address enumeration and keeps the public contract stable.

### Server-rendered admin

Astro pages and small HTMX/Alpine interactions keep authorization on the server and avoid a separate SPA/API authentication layer.

### Cloudflare-native reference deployment

Workers, D1, Email Service, Queues, rate limits, Turnstile, and Cron provide a connected example with little operational surface. They are implementation choices, not product requirements; ports should preserve behavior and trust boundaries.

## Changelog

All notable changes to Waiting Lists are recorded here. Versions follow semantic versioning; the public-facing release label may omit the patch number.

### 1.0.0 - 2026-08-01

Initial public release.

- Provides a self-hosted waiting-list service with email-only signup and double opt-in.
- Includes a private dashboard for lists, subscribers, delivery status, settings, and exports.
- Includes a private JSON API and command-line client for people, coding agents, and automation.
- Supports approved-origin form integration, Turnstile, rate limiting, and secure confirmation and removal links.
- Tracks consent and email-delivery state while minimizing retained subscriber data.
- Includes D1 migrations, Queue and Cron workflows, automated tests, and complete project documentation.
