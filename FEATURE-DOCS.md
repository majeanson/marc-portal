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

> Updated 2026-05-23 after the P1 + P2 sweep — all visitor-facing pages
> and critical API handlers documented. Lighter P3 + P4 surfaces (admin,
> OG endpoints, chrome components) are now the remaining gap.

| Surface     | Total | Documented | Gap |
| ----------- | ----: | ---------: | --: |
| `src/pages` |    33 |         24 |   9 |
| `src/components` |  47 |       2 |  45 |
| `functions/api` |  32 |        21 |  11 |
| `functions/_middleware.ts` | 1 | 1 | 0 |
| `functions/og`  |   4 |          0 |   4 |
| **Total**   |   117 |         48 |  69 |

The root `feature.json` (the "Marc-Portal" mega-feature) is healthy and
active; verified 2026-05-23. The 47 co-located feature.jsons + the root
all surface at `/meta` via `build-lac-meta.mjs`.

---

## P1 — Just-shipped, undocumented (acute)

Shipped this session in `f3ef8f1` → `05d57eb`; co-located docs written
during the same evening sweep.

- ✅ **src/pages/Passage.tsx** — `/passage` + `/en/passage`, the
  café-receipt rendering of the current visit's cookies, localStorage,
  and walked routes.
- ✅ **src/pages/Dossier.tsx** — `/me/dossier` + `/en/me/dossier`,
  auth-gated ledger vs. Meta with public-source citations.
- ✅ **src/pages/AuRevoir.tsx** — `/au-revoir` + `/en/goodbye`, the
  post-erasure ritual. Two branches, reduced-motion aware.

## P1 — Public marketing + transparency surfaces

All shipped 2026-05-23.

- ✅ **src/pages/Atelier.tsx** — the workshop walkthrough.
- ✅ **src/pages/Map.tsx** — `/carte` + `/en/map`.
- ✅ **src/pages/Meta.tsx** — `/meta`. The portal's `/meta` page; reads
  the LAC corpus this audit lives alongside.
- ✅ **src/pages/Privacy.tsx** — Loi 25 legal disclosure.
- ✅ **src/pages/Pia.tsx** — Privacy Impact Assessment.
- ✅ **src/pages/Vouches.tsx** — public testimonials wall.
- ✅ **src/pages/Vouch.tsx** — single-vouch detail page.
- ✅ **src/pages/PublicAdvancements.tsx** — `/share/:id`.
- ✅ **src/pages/Journey.tsx** — `/parcours` + `/en/journey`.
- ✅ **src/pages/HandoffChecklist.tsx** — `/handoff/checklist`.

## P2 — Auth-gated visitor surfaces

All shipped 2026-05-23.

- ✅ **src/pages/Login.tsx** — magic-link request form.
- ✅ **src/pages/MagicLinkSent.tsx** — post-submit confirmation.
- ✅ **src/pages/MePortal.tsx** — signed-in client dashboard.
- ✅ **src/pages/MyData.tsx** — Loi 25 right-of-access view.

## P2 — Critical API handlers (state-changing, security-sensitive)

All shipped 2026-05-23.

- ✅ **functions/_middleware.ts** — tenant resolution, CSRF gate,
  bilingual redirect, OG-tag rewrite.
- ✅ **functions/api/auth/request-link.ts** — magic-link issuer.
- ✅ **functions/api/auth/verify.ts** — magic-link consumer.
- ✅ **functions/api/auth/logout.ts**
- ✅ **functions/api/sessions/index.ts** — capacity-cap race fix (P1.7).
- ✅ **functions/api/sessions/[id].ts** — lifecycle PATCH + atomic guard.
- ✅ **functions/api/me.ts** — GET + DELETE.
- ✅ **functions/api/me/prefs.ts**
- ✅ **functions/api/payments/checkout.ts**
- ✅ **functions/api/payments/webhook.ts**
- ✅ **functions/api/payments/portal.ts**
- ✅ **functions/api/payments/index.ts**
- ✅ **functions/api/intake/transcribe.ts**
- ✅ **functions/api/intake-drafts.ts**
- ✅ **functions/api/sessions/[id]/messages.ts**
- ✅ **functions/api/sessions/[id]/advancements/index.ts**
- ✅ **functions/api/sessions/[id]/advancements/[advId].ts**
- ✅ **functions/api/sessions/[id]/attachments/index.ts**
- ✅ **functions/api/sessions/[id]/attachments/[attId].ts**
- ✅ **functions/api/vouches.ts** — anon vouch submission.

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

## Audit of the existing feature.json files

All bumped to `lastVerifiedDate: 2026-05-23` on 2026-05-23. Spot-check
of `componentFile` paths confirmed every reference resolves; no
detected drift in decisions or knownLimitations for the originals.

- ✅ feature.json (root, the mega-feature) — verified; added a
  statusHistory entry noting the FEATURE-DOCS gap audit + the
  ton-passage transparency arc shipped this session.
- ✅ src/pages/Home.feature.json
- ✅ src/pages/Intake.feature.json
- ✅ src/pages/Engagement.feature.json
- ✅ src/pages/Projects.feature.json
- ✅ src/pages/Handoff.feature.json
- ✅ src/pages/SessionPage.feature.json
- ✅ src/pages/Tier0.feature.json
- ✅ src/components/Pricing.feature.json
- ✅ src/components/VibeFilter.feature.json
- ✅ functions/api/capacity.feature.json

## Error / not-real-features (skip)

- ⏭ src/pages/NotFound.tsx, RouteError.tsx — boilerplate 404 + error
  boundary; no domain decisions to capture.
