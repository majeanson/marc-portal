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
- [ ] `ThemeToggle` wraps swap in `startViewTransition`
- [ ] `matchMedia` change listener wired
- [ ] `meta[name=theme-color]` swap on toggle + bootstrap
- [ ] CSS: 220ms root crossfade
- [ ] Committed (hash: __)

## Phase 3 — EN OG image
- [ ] `public/og-image-en.svg` authored
- [ ] `scripts/build-og-image.mjs` extended (both langs)
- [ ] Runtime `og:image` + `twitter:image` swap on lang change
- [ ] Decided: Pages middleware HTMLRewriter for crawlers? (yes/no/deferred)
- [ ] Committed (hash: __)

## Phase 4 — FAQ deep-link
- [ ] Slugged ids on each `<details>`
- [ ] Hash-on-mount + scroll-into-view
- [ ] Hash-on-toggle via `replaceState`
- [ ] Expand-all / collapse-all link
- [ ] Committed (hash: __)

## Phase 5 — ProjectCardPreview hardening
- [ ] 3-state machine (idle/loading/loaded/errored)
- [ ] Skeleton shimmer
- [ ] 5s timeout → errored fallback
- [ ] `onError` wired
- [ ] Committed (hash: __)

## Phase 6 — MobileStickyCta on /projects
- [ ] Mounted on `Projects.tsx`
- [ ] Visibility heuristic tuned for the gallery page
- [ ] Committed (hash: __)

## Phase 7 — Language switch view-transition
- [ ] FR/EN links use `Link` + `startViewTransition`
- [ ] Reduced-motion respected
- [ ] Committed (hash: __)

## Phase 8 — Time-travel scrubber on /share/:id
- [ ] `TimeTravelScrubber.tsx` written
- [ ] Mounted on `PublicAdvancements.tsx`
- [ ] Empty/1-build state handled (component returns null)
- [ ] Play/pause + keyboard nav
- [ ] i18n strings added
- [ ] Committed (hash: __)

## Phase 9 — /napkin whiteboard intake
- [ ] `@excalidraw/excalidraw` installed
- [ ] `Napkin.tsx` page authored
- [ ] Route registered (`/napkin`, `/en/napkin`)
- [ ] Submit → PNG into `intake-draft`, navigate to `/intake`
- [ ] Home page teaser link added
- [ ] Lazy-loaded chunk verified
- [ ] Committed (hash: __)

## Final — `npm run check`
- [ ] Full check green
- [ ] All commits pushed (or NOT pushed — see policy)
- [ ] Final state hash: __

---

## Crash recovery
If this run is interrupted, the resumer should:
1. Read `PLAN.md` for spec, `PROGRESS.md` for what's done.
2. `git log --oneline -20` to confirm which phases shipped.
3. Continue from the first unchecked phase.

## Decisions / deviations log
(Appended as work happens.)
