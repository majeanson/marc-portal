# Privacy Impact Assessment — Sentry integration

> **Statute:** Loi 25 (Quebec), art. 3.3 (PIA requirement for new
> projects involving personal info) and art. 17 (cross-border transfers).
> **Scope:** Adoption of Sentry (sentry.io) as the error-monitoring
> service for the marc-portal SPA + Pages Functions.
> **Status:** Internal record. Not filed with the Commission d'accès à
> l'information (CAI) unless requested. Maintained at `docs/loi-25-pia.md`.

---

## 1. Identification

| Field | Value |
|---|---|
| **Project** | Sentry error-monitoring integration for marc-portal |
| **Date of PIA** | 2026-05-15 |
| **Person responsible** (DPO de fait) | Marc Jeanson — marc@marcportal.com |
| **Operational scope** | marc-portal.pages.dev and any custom domain attached to the same Cloudflare Pages project. |
| **Decision** | Proceed. Residual risk assessed as **low** after the mitigations in §6 are in place. |

## 2. Description of the processing

The marc-portal frontend (`@sentry/react`) and Pages Functions (a
hand-rolled envelope poster in `functions/_lib/sentry.ts`) emit an
error event to Sentry whenever code throws an unhandled exception. The
event is transmitted over HTTPS to Sentry's US-region ingest endpoint
(`o4510241708244992.ingest.us.sentry.io`).

## 3. Data inventory

### 3.1 What is transmitted to Sentry

| Field | Source | Personal info? | Why |
|---|---|---|---|
| Error message, type | thrown `Error.message`, `.name` | Generally no | Required to identify the bug |
| Stack trace | thrown `Error.stack` | No (function names, file paths) | Required to locate the bug |
| Browser, OS, version | `User-Agent` parsing | No (technical metadata) | Reproduce environment-specific bugs |
| Page path | `window.location.pathname` (query string **stripped**) | No (path only) | "Where did this happen" |
| Environment tag | runtime inference (`production` / `preview` / `development`) | No | Filter prod vs preview |
| Breadcrumbs (navigation, fetches) | Sentry SDK auto-capture, **with query strings stripped** | No | Reproduce user path leading to error |
| User identity (`user.email`) | only when visitor is the operator (Marc) | The operator's own email | Help Marc filter his own QA errors in the Sentry UI |

### 3.2 What is explicitly excluded

- **Visitor's email** — not sent for anyone other than the operator.
  The operator is Marc; his own email going to his own Sentry org is
  not a third-party transfer of someone else's PI.
- **URL query strings** — stripped before send. Magic-link tokens
  (`/api/auth/verify?token=...`), share capability IDs (`/share/:id` —
  the id is in the path so still leaks, see §6.2 mitigations), and the
  `?lang=` parameter would all otherwise ride along.
- **Authentication headers** — `Cookie`, `Authorization`,
  `X-CSRF-Token` are deleted in `beforeSend` (client) and the
  equivalent server-side `requestSummary`.
- **IP address** — `sendDefaultPii: false` in the SDK + `user.ip_address`
  nullified defensively in `beforeSend`. Sentry's server-side
  "Prevent Storing of IP Addresses" toggle is enabled (operator action,
  see §6.4).
- **Request bodies** — neither the SDK nor our envelope poster
  serialize request bodies.
- **Session replays** — `replaysSessionSampleRate: 0`,
  `replaysOnErrorSampleRate: 0`.
- **Performance traces** — `tracesSampleRate: 0`.

## 4. Purposes (Loi 25 art. 8)

Diagnose and fix software defects that affect Quebec visitors. Without
error monitoring, defects surface only when a visitor explicitly reports
them via the messaging interface — many won't, and the visitor suffers a
broken experience in silence. Error monitoring is therefore strictly
necessary for the prestation of the service at the quality level the
practice commits to.

## 5. Cross-border transfer assessment (Loi 25 art. 17)

| Factor | Assessment |
|---|---|
| **Recipient** | Functional Software Inc., dba Sentry. 132 Hawthorne St, San Francisco, CA 94107, USA. |
| **Jurisdiction's legal framework** | United States. No federal omnibus privacy law equivalent to Loi 25 or GDPR; sector-specific (HIPAA, CCPA in California). Sentry voluntarily complies with GDPR, CCPA, ISO 27001, SOC 2 Type II. |
| **Equivalent protection** | Achieved contractually via Sentry's Data Processing Agreement (DPA), Standard Contractual Clauses (SCCs), and the technical mitigations enumerated in §6. The combination delivers protection materially equivalent to Loi 25 for the limited dataset transmitted. |
| **Volume** | Low. One operator, ~ one visitor at a time. Expected event rate: < 100/month. |
| **Sensitivity** | Telemetry only. No special categories of personal info (CCQ art. 12 — health, ethnic origin, etc.) ever touch the error pipeline. |
| **Necessity** | Operationally required to deliver the service quality committed in `/confidentialite`. |

**Conclusion:** the transfer is proportionate to the operational benefit.

## 6. Mitigations

### 6.1 Minimization (in code)

- Hardcoded DSN in `src/lib/sentry.ts` and `functions/_lib/sentry.ts`
  collapses the env-var attack surface; nothing for a build pipeline
  to leak.
- `beforeSend` strips Cookie, Authorization, X-CSRF-Token, URL query
  strings (both event and breadcrumbs), and nullifies `user.ip_address`.
- `setSentryUser` is admin-gated: `Sentry.setUser(null)` for every
  non-operator visitor.
- Server-side `requestSummary` emits `${origin}${pathname}` only — query
  strings are dropped at the envelope level too.

### 6.2 Residual risk: share-capability IDs in URL paths

Routes like `/share/:id` carry a 72-bit capability token in the URL
*path* (not the query string), so URL-path-as-PI debate applies. The
token authorizes read access to a public-share endpoint that
deliberately exposes a subset of session data (no PII; admin-curated
title + tagline). Loss of the token to Sentry is equivalent to loss of
the share URL itself — which the visitor was free to send to anyone.
**Residual risk: negligible.**

### 6.3 Sentry account / DPA (operational)

| Action | Owner | Status |
|---|---|---|
| Sign Sentry's Data Processing Agreement (sentry.io/legal/dpa/) | Marc | ✅ 2026-05-15 — signed copy at `docs/compliance/sentry-dpa-signed-2026-05-15.pdf` |
| Project retention = 30 days | Marc | ✅ 2026-05-15 — plan-default on Sentry's free/Developer plan; not user-configurable. If org ever upgrades to a paid plan, must explicitly re-set to 30 days (paid plans default higher). |
| Enable "Prevent Storing of IP Addresses" (Settings → Security & Privacy) | Marc | ✅ 2026-05-15 |
| Require Data Scrubber + Require Default Scrubbers (Settings → Security & Privacy) | Marc | ✅ 2026-05-15 |
| Enhanced Privacy toggle (Settings → Security & Privacy) | Marc | ✅ 2026-05-15 — strips PII from notifications + suppresses source snippets |
| Global Sensitive Fields supplement (session, session_cookie, csrf, csrf_token, authorization, cookie) | Marc | ✅ 2026-05-15 — defense-in-depth on top of code-side `beforeSend` |
| Document this PIA exists in `RUNBOOK.md` | Done | ✅ |

### 6.4 Visitor-facing notice (Loi 25 art. 8)

`/confidentialite` (FR) and `/en/privacy` (EN) sections 2, 5, and 6
explicitly disclose: existence of Sentry, what's collected, where it
goes, retention, and opt-out path. Section 7 explains the
right-of-access posture (Sentry events are anonymized server-side, so
there is no individual record to exfiltrate).

## 7. Rights handling (art. 27 / 28 / 28.1)

- **Right of access (art. 27)**: Sentry events do not carry a
  visitor's identity (see §3.1). When a visitor asks "what do you
  have on me?", the canonical response with respect to Sentry is "no
  events about you specifically; Sentry events are anonymous." This
  is more defensible than a per-visitor Sentry query would be.
- **Right of rectification (art. 28)**: not applicable to error events
  (visitors can't rectify a stack trace they didn't produce).
- **Right of erasure (art. 28.1)**: the 30-day retention auto-purges.
  If a visitor demands faster erasure and we cannot identify their
  events (since they're anonymous), we treat the request as satisfied
  by the existing minimization posture. If we ever start tagging
  visitor identity to events (we don't today), this PIA must be
  revisited.

## 8. Breach posture (art. 3.5 + 3.6)

Sentry has its own incident-response and breach-notification
obligations under their DPA. In the event Sentry notifies Marc of a
breach affecting marc-portal events:

1. Determine which events were exposed (Sentry's incident report
   typically scopes this).
2. Per §3.1, no PII for non-operator visitors → for visitors, no
   notification to CAI or individuals is required (no risk of serious
   harm because no identifying info was at stake).
3. For the operator-tagged events: notify Marc (himself) — no other
   data subjects affected.

## 9. Review schedule

This PIA is reviewed:
- Annually on the anniversary of integration (2026-05-15).
- Whenever Sentry's configuration changes (sampling rates, new
  integrations, replay/performance enablement).
- Whenever the marc-portal data model adds a class of personal info
  that could surface in stack traces or breadcrumbs.

Next scheduled review: **2027-05-15**.

---

*Signed off-line. Internal record. Provide on request to CAI under
art. 81.*
