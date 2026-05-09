# marc-portal

Marc's solo-practice client portal. Quebec-side dev gig, async, 1 active build at
a time. Deployed at <https://marc-portal.pages.dev> (or wherever the custom
domain is pointed).

```text
React + Vite SPA  ──►  Cloudflare Pages
                       │
Cloudflare Pages ──►   D1 (sessions / messages / magic-link tokens / attachments)
Functions (api/*)      R2 (attachment blobs, optional)
                       Resend (transactional email)
```

## Quickstart

```bash
nvm use                       # Node 22+ (.nvmrc)
npm install
cp .dev.vars.example .dev.vars   # edit RESEND_API_KEY, SESSION_SECRET, ADMIN_EMAILS
npm run db:migrate:local       # apply D1 migrations to the local SQLite
npm run dev                   # vite on :5173 + functions via wrangler proxy
```

For prod builds, see `wrangler.toml` for the D1 + R2 bindings and the
Cloudflare dashboard for environment variables.

## Scripts

| Command                     | What it does                                              |
| --------------------------- | --------------------------------------------------------- |
| `npm run dev`               | Vite dev server (frontend only, mocks /api)               |
| `npm run dev:cf`            | Wrangler pages dev — frontend + Functions on the same port |
| `npm run typecheck`         | `tsc -b --noEmit`                                         |
| `npm run lint`              | ESLint                                                    |
| `npm run test:run`          | Vitest (one shot)                                         |
| `npm run check`             | typecheck + lint + format:check + test:run + lac-lint     |
| `npm run build`             | Production build to `dist/`                               |
| `npm run db:migrate:local`  | Apply D1 migrations to the local environment              |
| `npm run db:migrate:prod`   | Apply D1 migrations to remote (CF auto-runs this on deploy) |

## Required environment variables

Set in the Cloudflare Pages dashboard (Settings → Environment variables):

| Var               | Required     | Purpose                                                |
| ----------------- | ------------ | ------------------------------------------------------ |
| `SESSION_SECRET`  | **required** | HMAC key for the session cookie. ≥ 32 random chars.    |
| `RESEND_API_KEY`  | **required** | <https://resend.com> — transactional emails.           |
| `ADMIN_EMAILS`    | **required** | Comma-separated allowlist (first one is "Marc").        |
| `DIGEST_TOKEN`    | optional     | Shared secret guarding `/api/admin/digest`.            |
| `CF_API_TOKEN`    | optional     | Buyer-domain auto-attach (operator console).           |
| `CF_ACCOUNT_ID`   | optional     | Same.                                                  |
| `CF_PAGES_PROJECT_NAME` | optional | Same.                                                  |

If `SESSION_SECRET` is missing or shorter than 32 chars, every auth-touching
handler throws on the first request — by design, to prevent silent HMAC
downgrades.

## Project layout

```
src/                — React SPA (Vite)
  pages/            — top-level route components
  components/       — shared UI
  lib/              — pure helpers (fetch wrappers, formatters, schemas)
functions/          — Cloudflare Pages Functions (file-routed under /api/*)
  _lib/             — server-side helpers (auth, D1 queries, email)
  api/              — public + auth + admin endpoints
  db/migrations/    — numbered .sql files, applied in order
public/             — static assets (favicon, og-image, audio)
feat-*/feature.json — Life-as-Code feature documents (drives the showcase wall)
```

## Bedrock rule

**1 active build + 1 in triage. No exceptions.**

Enforced server-side in `functions/_lib/sessions.ts` (`countActiveAndTriage`,
`isActiveAtCap`, `isTriageAtCap`). `POST /api/sessions` and
`PATCH /api/sessions/:id { status }` return `409` when the cap would be
exceeded. `/api/capacity` is the single read-side source of truth — there is no
static fixture.

If you find yourself raising the cap, stop and reread Insight #39 in the
brainstorming session.

## Operations

- **Production runbook:** [RUNBOOK.md](./RUNBOOK.md)
- **Privacy policy (Loi 25):** `/confidentialite` (`/en/privacy`)
- **Audit log:** `/admin/audit`
- **Health check:** `GET /api/health` → `{ ok, db, ts }`
