# Portal — Autonomous Run Progress

> Started: 2026-05-15. Plan: `PLAN.md`.
> One checkbox per phase. Sub-bullets are notes for the resumer.

## Phase 1 — Data router migration
- [x] `main.tsx` migrated to `createBrowserRouter` + `RouterProvider`
- [x] Providers (Tenant, Auth) lifted above `<RouterProvider>` (cleanest path — they take `children`, don't need router context)
- [x] Routes moved from `App.tsx` into `createRoutesFromElements(...)` (kept JSX style; minimal diff)
- [x] `App.tsx` deleted (no longer referenced)
- [x] `Napkin.tsx` stubbed (Phase 9 fills it in) so typecheck passes with the route wired
- [x] Typecheck green
- [x] Tests green (153/153)
- [x] Committed (hash: pending)

## Phase 2 — Theme polish + view-transition
- [x] `ThemeToggle` wraps swap in `startViewTransition` (feature-detected; Firefox snaps)
- [x] `matchMedia` change listener wired (only acts when user hasn't toggled)
- [x] `meta[name=theme-color]` swap on toggle + bootstrap (cream / ink)
- [x] CSS: 280ms root crossfade (reduced-motion already collapses to 80ms)
- [x] Committed (hash: pending)

## Phase 3 — EN OG image
- [x] `public/og-image-en.svg` authored
- [x] `public/og-image-en.png` generated (53.9 KB)
- [x] `scripts/build-og-image.mjs` extended (loops over variants)
- [x] Runtime `og:image` + `twitter:image` + `og:locale` swap on lang change in `Home.tsx`
- [x] Pages middleware HTMLRewriter: **deferred**. Static index.html ships FR OG; bots hitting `/en` see FR OG until SSR/middleware is added. Documented as a known gap.
- [x] Committed (hash: pending)

## Phase 4 — FAQ deep-link
- [x] Stable slugs shared FR/EN (price, timeline, result, unclear, ownership, bring-own)
- [x] `id="faq-<slug>"` on each `<details>`
- [x] Hash-on-mount opens + scrolls into view
- [x] Hash-on-toggle via `replaceState` (no jump)
- [x] Expand-all / collapse-all toggle, dashed-underline mono button
- [x] Committed (hash: pending)

## Phase 5 — ProjectCardPreview hardening
- [x] 4-state machine (idle/loading/loaded/errored)
- [x] Shimmer skeleton overlay during loading
- [x] 5s timeout → errored fallback (gradient placeholder)
- [x] `onError` wired
- [x] No layout shift between states (skeleton & fallback are absolute-positioned within fixed aspect-ratio box)
- [x] Committed (hash: pending)

## Phase 6 — MobileStickyCta on /projects
- [x] Mounted on `Projects.tsx`
- [x] Component generalized with `appearAfterRatio` and `hideNearSelectors` props (defaults preserve home behavior)
- [x] Projects passes `appearAfterRatio={0.3}` since no hero on this page
- [x] Default hide-near now considers `.site-footer` too (not just `#cta`)
- [x] Refactor: extracted `src/router.tsx` (router config) from `main.tsx` so the entry file is just `createRoot + RouterProvider`; eslint react-refresh rule is happy now
- [x] Tightened `ProjectCardPreview` outcome state machine (lint: no setState-in-effect)
- [x] Committed (hash: pending)

## Phase 7 — Language switch view-transition
- [x] FR/EN clicks intercepted with `startViewTransition` → router `navigate`
- [x] Same-path swap: `/projects` ↔ `/en/projects`, not `/projects` → `/en`
- [x] cmd/ctrl/middle-click preserved (open-in-new-tab still works)
- [x] Same-language click no-ops (no needless navigate)
- [x] Reduced-motion handled by existing CSS root crossfade rule
- [x] Committed (hash: pending)

## Phase 8 — Time-travel scrubber on /share/:id
- [x] `TimeTravelScrubber.tsx` written — iframe + meta row + Prev/Play/Pause/Next + notched track
- [x] Mounted at the bottom of the article on `PublicAdvancements.tsx`
- [x] Returns null when fewer than 2 buildable advancements
- [x] Play auto-advances every 3.5s, stops at the last step (doesn't loop)
- [x] Keyboard nav: ←/→ step, Space toggles play (when reduced-motion is off)
- [x] Reduced-motion hides the Play button; arrows still work
- [x] i18n strings added under `sessionAdvancements.scrubber` (FR + EN)
- [x] Active notch sage-filled; past notches sage-soft; future hollow
- [x] Committed (hash: pending)

## Phase 9 — /napkin whiteboard intake
- [x] `@excalidraw/excalidraw` installed (397 packages — npm audit shows 14 moderate/1 high in indirect deps; not pursuing without user consent)
- [x] `Napkin.tsx` page authored (lazy import of `Excalidraw` + dynamic `exportToBlob`)
- [x] Route registered (`/napkin`, `/en/napkin`) via router.tsx (was already wired with stub in Phase 1)
- [x] Submit → PNG (data URL) into `marc-portal:napkin-sketch`; intake-draft flagged with `__hasNapkinSketch`; navigate to `/intake?from=napkin`
- [x] Home page teaser link added under InlineIntakeTeaser (dashed mono, soft)
- [x] Lazy-loaded chunk verified: production build splits Excalidraw into its own chunks (mermaid, katex, etc.); main bundle unaffected
- [x] Sitemap regenerated (now 14 URLs incl. /napkin + /en/napkin)
- [x] i18n strings under `napkin` (FR + EN)
- [x] Committed (hash: pending)

## Known gaps to follow up
- Per-project OG image generation (C.8): deferred. Static index.html ships FR OG; crawlers on `/en` see FR.
- Per-language OG via SSR/middleware: deferred. Runtime swap covers human re-share but not initial crawl on `/en`.
- Server-side upload of napkin PNG: not wired. PNG lives only in localStorage; `/intake` doesn't yet pick it up and attach. Follow-up:
  1. Detect `formData.__hasNapkinSketch` in Intake.tsx → show "sketch attached ✓" pill.
  2. On `createSession`, base64 upload the PNG as an attachment (new endpoint).
- `npm audit` reports 15 vulnerabilities (14 moderate, 1 high) brought in by Excalidraw's deep dep tree. Worth a `npm audit fix` pass with user approval next session.

## Final — `npm run check`
- [x] typecheck: clean
- [x] eslint: clean (0 errors, 0 warnings)
- [x] prettier: clean (re-formatted 6 files; committed below)
- [x] lac-lint: skipped (no global lac CLI installed) — same as before
- [x] vitest: 153/153 pass
- [x] Production build (`npm run build`): clean. Excalidraw splits into its own chunk set, main bundle unaffected.
- [x] All 9 phases shipped as separate commits on `main`. NOT pushed (per policy — user pushes).
- [x] Final state hash: (this commit)

---

## Crash recovery
If this run is interrupted, the resumer should:
1. Read `PLAN.md` for spec, `PROGRESS.md` for what's done.
2. `git log --oneline -20` to confirm which phases shipped.
3. Continue from the first unchecked phase.

## Decisions / deviations log
(Appended as work happens.)
