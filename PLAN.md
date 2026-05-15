# Portal — Atelier Completion + Oomph Plan

> Approved: 2026-05-15.
> One autonomous run. Each phase ships as its own commit on `main`.
> Progress lives in `PROGRESS.md`. This file is the spec; that file is the log.

## Scope

**In**
- A. Migrate `main.tsx` to a data router (`createBrowserRouter` + `RouterProvider`). Unblocks view-transition hooks already in code.
- B. Complete all P1 polish items from the May 14 atelier audit.
- C. Three creative oomph items:
  - **C.15** — Time-travel scrubber on `/share/:id` (replay a project's build through time).
  - **C.16** — `/napkin` whiteboard intake (Excalidraw-style canvas → intake draft).
  - **C.20** — Language-switch view transition.
  - **C.21** — Theme-toggle view transition.

**Deferred (do not implement now)**
- C.8 (per-project OG images) — solve when the share feature gets real-world use; needs SSR or bot-aware Pages Function. Static home OG is fine for now.
- All other oomph ideas from the brainstorm.

**Constraint**
- Each phase: implement → typecheck/test → commit. No phase is allowed to leave the tree red. Use `npm run check` (typecheck + lint + format + lac-lint + tests) at minimum before commit. If a phase can't pass, fix in the same phase before moving on.

---

## Phase 1 — Data router migration

**File:** `src/main.tsx`, possibly `src/App.tsx`.

Replace:
```tsx
<BrowserRouter>
  <TenantProvider><AuthProvider><App /></AuthProvider></TenantProvider>
</BrowserRouter>
```
with `createBrowserRouter([...])` + `<RouterProvider router={router} />`. The providers must sit **above** the router so existing `useAuth`/`useTenant` calls in route components keep working — accomplish this by:
- Creating a root layout route whose `element` is `<TenantProvider><AuthProvider><Outlet/></AuthProvider></TenantProvider>` wrapping a child `<App/>` that still renders `<Routes>`. *Or* (cleaner) lift the entire route tree into the `createBrowserRouter` config and drop `<Routes>/<Route>` from `App.tsx` entirely.

I'll take the second path: full migration to route objects. `App.tsx` becomes a re-export of the router-built tree (or is deleted). Lazy children stay lazy via `lazy: async () => ({ Component: ... })`.

**Acceptance**
- `/`, `/en`, `/intake`, `/projects`, `/share/:id`, `/admin/...` all mount.
- `FeaturedProjects` and `Projects` no longer throw `useViewTransitionState must be used within a data router`.
- All existing tests pass.

---

## Phase 2 — Theme polish + view-transition swap

**Files:** `src/components/ThemeToggle.tsx`, `public/theme-bootstrap.js`, `src/styles.css` (small additions).

- Wrap the day↔night swap in `document.startViewTransition(() => setTheme(...))` when available (feature-detect). On no-support browsers (Firefox today), the state setter still runs synchronously.
- Listen to `window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', ...)` and update theme **only** if the user hasn't made an explicit choice yet (`localStorage.getItem('marc-portal:theme') === null`).
- Add a `<meta name="theme-color">` swap: cream (`#f6f1e6`) in day, ink (`#181613`) in night. Both `theme-bootstrap.js` and the toggle write this.
- CSS: wrap the cross-fade with `::view-transition-old(root)`/`::view-transition-new(root)` overrides to 220ms ease (currently inherits browser default).

**Acceptance**
- Toggle produces a visible cross-fade in Chromium; instant swap in Firefox.
- OS theme change mid-session updates the page (only when user hasn't toggled).
- Address bar tint matches theme on mobile Safari/Chrome.

This phase fulfills both P1.3 and **C.21**.

---

## Phase 3 — EN OG image

**Files:** `public/og-image-en.svg` (new), `scripts/build-og-image.mjs` (extend to process both languages), `index.html` (default lang stays FR), `src/pages/Home.tsx` and `src/pages/RootByTemplate.tsx` (or wherever lang is known).

- Author an EN variant of `og-image.svg`, same layout, EN copy.
- Extend the build script to take an arg (`fr | en | all`) or just always process both.
- The static `index.html` keeps `og:image=/og-image.png` (FR default — bots will likely hit `/` first).
- At runtime, when `lang === 'en'` (i.e., on `/en`*), `useEffect` swaps `meta[property="og:image"]` and `meta[name="twitter:image"]` to `/og-image-en.png`. This benefits *human* shares from `/en` pages via copy-link, since some clients re-resolve OG on share.
- For crawler-correctness on `/en` URLs, add a Pages Function `functions/_middleware.ts` (or extend the existing) to rewrite OG `<meta>` tags by lang prefix using `HTMLRewriter`. Out of scope **if** the existing middleware is non-trivial — fall back to runtime-only and document the gap in `PROGRESS.md`.

**Acceptance**
- `/og-image-en.png` exists, valid 1200×630.
- Browser DevTools on `/en` shows `og:image` pointing to the EN PNG after JS runs.

---

## Phase 4 — FAQ deep-link

**File:** `src/components/FAQ.tsx`.

- Slugify each question (stable, lowercase, hyphenated) → use as `id` on the `<details>`.
- On mount: read `location.hash`, open the matching item if any, smooth-scroll it into view.
- On toggle: `history.replaceState(null, '', '#' + slug)` when opening; clear when closing.
- "Expand all / Collapse all" mono link above the list.

**Acceptance**
- `/#faq-prix` (or equivalent slug) opens that item.
- Toggle updates the URL hash live (no jumping).

---

## Phase 5 — ProjectCardPreview error / loading

**File:** `src/components/ProjectCardPreview.tsx`, `src/styles.css`.

- Add a 3-state machine: `idle | loading | loaded | errored`.
- Show a shimmer/gradient placeholder while `loading`.
- 5s `setTimeout` → if still not loaded, mark `errored` and show a static "build pending" gradient.
- `onError` on the iframe → mark `errored`.
- Tighten sandbox: remove `allow-same-origin` where we can; if a build relies on it we keep it but document.

**Acceptance**
- Slow/blocked iframe gracefully degrades to placeholder.
- No layout shift between states.

---

## Phase 6 — MobileStickyCta on /projects

**File:** `src/pages/Projects.tsx`.

- Mount `<MobileStickyCta lang={lang} />` at the bottom of the page.
- Tune visibility: show after scrolling ~80vh; hide near footer (look for `.site-footer` or pass an anchor id).

**Acceptance**
- ≤768px viewport on `/projects`: pill appears after first scroll, hides near footer.

---

## Phase 7 — Language switch view-transition

**File:** `src/components/Header.tsx`.

- Convert FR/EN `<a>` to `<Link>` (data router required → unlocked by phase 1).
- On click, wrap navigate in `startViewTransition` when available. The whole page crossfades.
- Reduced-motion: collapse to 80ms (already in CSS for `::view-transition-old/new(root)`).

**Acceptance**
- FR↔EN swap fades instead of hard-reloading.
- Hreflang remains correct on the rendered link (`hrefLang="fr-CA"` / `en-CA`).

---

## Phase 8 — Time-travel scrubber on `/share/:id`

**File:** `src/pages/PublicAdvancements.tsx`, new `src/components/TimeTravelScrubber.tsx`, CSS additions.

- Below the advancements list, mount the scrubber.
- Component:
  - Takes the list of advancements that have `build_url` (filter on render).
  - Renders a single iframe locked at the current scrub index.
  - Horizontal track with one notch per buildable advancement (mono dates beneath).
  - Prev / Next / Play (auto-advance every 3.5s) / Pause buttons.
  - Active step shows label + date + relative ("3 weeks ago").
- Empty state if 0 or 1 buildable advancements: hide the scrubber.
- `prefers-reduced-motion` disables auto-play (button hidden), keeps Prev/Next.
- Keyboard: ←/→ to step.
- i18n strings in `src/i18n.ts` under `sessionAdvancements.scrubber`.

**Acceptance**
- A session with 3+ buildable advancements shows the scrubber.
- Stepping reloads the iframe to that advancement's URL.
- Play auto-advances; loops; pauses at end.

---

## Phase 9 — `/napkin` whiteboard intake

**File:** new `src/pages/Napkin.tsx`, route in `main.tsx` router config, i18n strings.

- Install `@excalidraw/excalidraw` (MIT, ~600KB gzip — lazy-load only on this route).
- Page layout:
  - Header (same as everywhere).
  - Eyebrow + short instruction: "Sketch your problem in 60 seconds."
  - Excalidraw canvas, ~600px tall.
  - Two-line text input "What is this about?" + "Email (optional)".
  - "Send to intake" button.
- On submit:
  - Export Excalidraw scene as PNG via `exportToBlob`.
  - Save to localStorage under `intake-draft` as `napkinPng` (base64 data URL) + `napkinText`.
  - Optionally write to the intake draft `formData` so the type-picker is bypassed if a type is inferable.
  - Navigate to `/intake?from=napkin`.
- Link from the home page (a discreet line under the InlineIntakeTeaser: "Prefer to draw? Try the napkin →").
- Lazy-load Excalidraw via `lazy()` to keep the main bundle untouched.
- Excalidraw fonts/assets: ship via the package; verify the build still passes `vite build` and CSP doesn't choke (likely needs `worker-src` allowance).

**Acceptance**
- `/napkin` and `/en/napkin` render the canvas.
- Drawing + submitting lands you on `/intake` with the PNG present in draft.
- Bundle size jump is contained to the `/napkin` chunk.

---

## Final — `npm run check`

- After phase 9, run the full check (`npm run check`).
- If green, append final commit (if any cleanup happened) and stop.
- If red, fix in place. No leaving red.

---

## Commit message style

Follow the existing pattern from `git log`:
- `feat(scope): short summary — what changed`
- Body: bullet points with the WHY.
- `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>` trailer.

## Out-of-band rules

- Never `git push --force`. Never `--no-verify`.
- Never amend prior commits — always new commits.
- `PROGRESS.md` updated *before* each commit in the same commit.
