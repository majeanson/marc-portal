# Feature-doc gap audit

> Started: 2026-05-23. Companion to AUDIT.md, but scoped specifically to
> co-located `feature.json` coverage — the LAC docs that surface on
> `/meta` and travel with the code they describe.
>
> Status legend: ⬜ no feature.json · 🟡 draft/active · ✅ frozen ·
> ⏭ deferred (intentional) · ⚠ stale (verify or re-author).
>
> Priority legend:
> - **P1** — visitor-facing or just-shipped; the doc gap shows up on
>   `/meta` and in cross-feature impact queries.
> - **P2** — auth-gated or critical infrastructure; documented for the
>   next maintainer's 11pm.
> - **P3** — admin / internal / utility; document opportunistically.
> - **P4** — chrome components (no standalone user-meaning); usually
>   skip — feature.json only earns its keep when the surface IS the
>   feature, not a generic primitive used by it.
>
> When picking one off: flip to 🟡, walk the LAC lifecycle
> (`create_feature` → `read_feature_context` → `write_feature_fields` →
> `advance_feature(active)` → `advance_feature(frozen)`), then ✅.

---

## Coverage at a glance

| Surface     | Total | Documented | Gap |
| ----------- | ----: | ---------: | --: |
| `src/pages` |    33 |          7 |  26 |
| `src/components` |  47 |       2 |  45 |
| `functions/api` |  32 |       1 |  31 |
| `functions/_middleware.ts` | 1 | 0 | 1 |
| `functions/og`  |   4 |          0 |   4 |
| **Total**   |   117 |         10 | 107 |

The root `feature.json` (the "Marc-Portal" mega-feature) is healthy and
active. This audit is about the co-located docs that sit next to the
code they describe.

---

## P1 — Just-shipped, undocumented (acute)

These shipped this session (commits `f3ef8f1` → `05d57eb`) and have zero
documentation. They will be authored tonight.

- 🟡 **src/pages/Passage.tsx** — `/passage` + `/en/passage`, the
  café-receipt rendering of the current visit's cookies, localStorage,
  and walked routes. Felt version of Privacy.
- 🟡 **src/pages/Dossier.tsx** — `/me/dossier` + `/en/me/dossier`,
  auth-gated. Side-by-side ledger of what the portal keeps vs. what
  Meta collects, with public-source citations.
- 🟡 **src/pages/AuRevoir.tsx** — `/au-revoir` + `/en/goodbye`,
  the post-erasure ritual page. Two branches (just-erased vs. direct
  visit); reduced-motion aware.

## P1 — Public marketing + transparency surfaces

- ⬜ **src/pages/Atelier.tsx** — the workshop walkthrough.
- ⬜ **src/pages/Map.tsx** — `/carte` + `/en/map`. Cytoscape graph of
  every page + feature; filters by `?feature=X`.
- ⬜ **src/pages/Meta.tsx** — `/meta`. Renders the LAC corpus
  (this audit's mirror lives there).
- ⬜ **src/pages/Privacy.tsx** — Loi 25 legal disclosure.
- ⬜ **src/pages/Pia.tsx** — Privacy Impact Assessment.
- ⬜ **src/pages/Vouches.tsx** — public testimonials wall.
- ⬜ **src/pages/Vouch.tsx** — single-vouch detail page.
- ⬜ **src/pages/PublicAdvancements.tsx** — `/share/:id`. Per-build
  share page with the time-travel scrubber.
- ⬜ **src/pages/Journey.tsx** — `/parcours` + `/en/journey`, the
  step-by-step "how the practice works" walkthrough.
- ⬜ **src/pages/HandoffChecklist.tsx** — `/handoff/checklist`.

## P2 — Auth-gated visitor surfaces

- ⬜ **src/pages/Login.tsx** — magic-link request form.
- ⬜ **src/pages/MagicLinkSent.tsx** — post-submit confirmation.
- ⬜ **src/pages/MePortal.tsx** — signed-in client dashboard.
- ⬜ **src/pages/MyData.tsx** — Loi 25 right-of-access view.

## P2 — Critical API handlers (state-changing, security-sensitive)

- ⬜ **functions/_middleware.ts** — tenant resolution, CSRF gate,
  bilingual redirect, OG-tag rewrite. Load-bearing infrastructure;
  documented behaviour matters for the next maintainer.
- ⬜ **functions/api/auth/request-link.ts** — magic-link issuer.
- ⬜ **functions/api/auth/verify.ts** — magic-link consumer.
- ⬜ **functions/api/auth/logout.ts**
- ⬜ **functions/api/sessions/index.ts** — POST creates new sessions;
  carries the capacity-cap race fix (AUDIT P1.7).
- ⬜ **functions/api/sessions/[id].ts** — session lifecycle PATCH;
  atomic capacity guard lives here.
- ⬜ **functions/api/me.ts** — GET + DELETE; the DELETE is the
  erasure ritual's backend half.
- ⬜ **functions/api/me/prefs.ts**
- ⬜ **functions/api/payments/checkout.ts** — Stripe Checkout creator.
- ⬜ **functions/api/payments/webhook.ts** — Stripe webhook handler.
- ⬜ **functions/api/payments/portal.ts** — Stripe billing portal.
- ⬜ **functions/api/payments/index.ts**
- ⬜ **functions/api/intake/transcribe.ts** — Workers AI Whisper
  proxy; documented graceful-degrade pattern when AI binding unset.
- ⬜ **functions/api/intake-drafts.ts**
- ⬜ **functions/api/sessions/[id]/messages.ts**
- ⬜ **functions/api/sessions/[id]/advancements/index.ts**
- ⬜ **functions/api/sessions/[id]/advancements/[advId].ts**
- ⬜ **functions/api/sessions/[id]/attachments/index.ts**
- ⬜ **functions/api/sessions/[id]/attachments/[attId].ts**
- ⬜ **functions/api/vouches.ts** — anon vouch submission (rate-limited).

## P3 — Public read-only API + utilities

- ⬜ **functions/api/public/projects.ts**
- ⬜ **functions/api/public/vouches.ts**
- ⬜ **functions/api/public/sessions/[id]/advancements.ts**
- ⬜ **functions/api/tenant.ts**
- ⬜ **functions/api/tenant/theme.ts**
- ⬜ **functions/api/meta/stats.ts**
- ⬜ **functions/api/health.ts**
- ⬜ **functions/og/share/[id].ts** — dynamic OG card.
- ⬜ **functions/og/home.ts**
- ⬜ **functions/og/certificate/[id].ts**
- ⬜ **functions/og/ping.ts**

## P3 — Admin surfaces (direct-URL only, not in sidebar)

Marketplace-shaped pages kept reachable for a hypothetical buyer (per
root `feature.json`'s 2026-05-09 note). Documenting them is low ROI
unless the buyer story re-opens — defer unless boredom.

- ⏭ src/pages/Admin.tsx, AdminAudit, AdminCustodians, AdminHub,
  AdminInbox, AdminRunbook, AdminShowcase, AdminTrash, AdminVouches
- ⏭ functions/api/admin/audit.ts, digest.ts, test-emails.ts,
  vouches.ts, vouches/[id].ts

## P4 — Shared chrome components

Most components are generic UI primitives; a feature.json next to
`Header.tsx` or `Footer.tsx` would document the chrome, not a feature.
Only components that ARE a standalone user-meaning earn one — the
existing precedent (`Pricing.feature.json`, `VibeFilter.feature.json`)
is the bar.

**Worth documenting** (standalone user-meaning):
- ⬜ **src/components/FAQ.tsx**
- ⬜ **src/components/HowItWorks.tsx**
- ⬜ **src/components/About.tsx**
- ⬜ **src/components/FeaturedProjects.tsx**
- ⬜ **src/components/BringAnything.tsx**
- ⬜ **src/components/Testimonials.tsx**
- ⬜ **src/components/Hero.tsx**
- ⬜ **src/components/TimeTravelScrubber.tsx** (AUDIT P3.1–P3.3
  shipped behaviour worth co-locating)
- ⬜ **src/components/NapkinReplay.tsx**
- ⬜ **src/components/SketchCanvas.tsx**
- ⬜ **src/components/VoiceRecorder.tsx**

**Skip** (chrome — no standalone user-meaning; the feature lives
elsewhere): Header, Footer, PageMast, FeatureDot, FeatureContinue,
CrossFeatureLink, FeatureFolioLink, CTA, EnglishNudge, EmailTestCard,
FirstNameCard, HeroShippedProject, HomeDrillCard, InlineIntakeTeaser,
LangPrefCard, MobileStickyCta, NapperonDoodles, PaymentActions,
ProjectCardPreview, PullQuote, Runbook, RunbookParallel, Scorecard,
ScrollProgress, SectionEyebrow, SectionRail, SessionAdvancements,
SessionShowcase, SessionSubHeader, SessionWhatsNext, ShareModal,
ShareSite, SiteSearch, StudioSign, ThemeToggle.

## Audit of the 10 existing feature.json files

Read each for staleness — file paths still exist, decisions still
describe today's reality, knownLimitations not contradicted by recent
commits.

- ⬜ feature.json (root, the mega-feature) — `lastVerifiedDate` line
  to spot-check; root doc tends to drift fastest.
- ⬜ src/pages/Home.feature.json
- ⬜ src/pages/Intake.feature.json
- ⬜ src/pages/Engagement.feature.json — verified 2026-05-21.
- ⬜ src/pages/Projects.feature.json
- ⬜ src/pages/Handoff.feature.json
- ⬜ src/pages/SessionPage.feature.json
- ⬜ src/pages/Tier0.feature.json
- ⬜ src/components/Pricing.feature.json
- ⬜ src/components/VibeFilter.feature.json
- ⬜ functions/api/capacity.feature.json

## Error / not-real-features (skip)

- ⏭ src/pages/NotFound.tsx, RouteError.tsx — boilerplate 404 + error
  boundary; no domain decisions to capture.
