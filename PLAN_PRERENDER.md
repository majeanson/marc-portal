# PLAN — homepage prerender

> Next step after the /meta overhaul + perf pass. Decisions are locked.
> Start at Phase 1. Best done as its own focused session — it needs
> deploy→verify cycles and touches production routing.

## Goal

The homepage (`/` and `/en`) is client-rendered. After self-hosting fonts and
trimming the entry bundle, Lighthouse performance is **81** — the rest of the
gap is the SPA ceiling: nothing meaningful paints until the JS bundle loads,
parses, and renders. Prerender the homepage to static HTML so content paints
immediately (FCP/LCP), then let the SPA boot over it. Target: **90+**.

## Decision — browser snapshot, not SSR (locked)

Snapshot the real browser-rendered DOM with Playwright (already a devDep),
not `react-dom/server`. Why:

- The app already runs perfectly in a browser — zero app refactor.
- SSR would force a react-router static-handler rewrite (`main.tsx` uses
  `createBrowserRouter`), risk `window`/`document`-during-render crashes
  across the ~13 homepage section components, and hydration-mismatch debugging.
- `main.tsx` keeps `createRoot().render()` (not `hydrateRoot`). The
  prerendered HTML gives the fast FCP/LCP; the SPA then re-renders `#root`.
  Seamless as long as the snapshot ≈ the booted render.

## The sharp edge — SPA fallback (locked fix)

`public/_redirects` is `/*  /index.html  200` — every route falls back to
`index.html`. If `index.html` holds prerendered homepage content, every
deep-route direct load flashes the homepage before the router corrects.

Fix — keep a clean shell for the fallback:

- `dist/index.html` → prerendered **FR** homepage (Pages serves it for `/`).
- `dist/en/index.html` → prerendered **EN** homepage (served for `/en`).
- `dist/app.html` → the clean Vite shell, empty `#root`.
- `public/_redirects` → `/*  /app.html  200`. Cloudflare Pages serves an
  existing file before applying a rule, so `/`→`index.html` and
  `/en`→`en/index.html` are served directly; only non-file routes hit the
  rule → clean shell. No flash anywhere.

## Phases

1. **Prerender script** — `scripts/prerender.mjs`, wired as the npm
   `postbuild` script (npm runs it automatically after `build`):
   - a. Copy `dist/index.html` → `dist/app.html` FIRST (the clean shell must
     exist before anything else — it is the deep-route fallback).
   - b. `vite preview` on `dist/`; Playwright (chromium) loads
     `http://localhost:4173/`, waits for `.app` + network idle + fonts ready,
     snapshots `document.documentElement.outerHTML`.
   - c. Snapshot `/en` the same way.
   - d. Write the snapshots to a temp path, then atomically overwrite
     `dist/index.html` and write `dist/en/index.html` — only on success.
   - e. Keep the `<script type="module">` tag in the snapshot so the SPA boots.
   - **Fail-soft**: if the snapshot fails, leave `dist/index.html` as the
     clean shell and exit 0 — a deploy must never be blocked by prerender.

2. **Redirects** — `public/_redirects` → `/*  /app.html  200`.

3. **Deploy workflow** — `deploy.yml` runs `npm run build`, so `postbuild`
   runs in CI. Add `npx playwright install --with-deps chromium` before the
   build step (mirror `e2e.yml`). ~30s added to deploy.

4. **Verify on a real deploy**:
   - a. `/` and `/en` serve prerendered HTML — view-source shows the content.
   - b. `/intake`, `/projects`, `/meta`, `/tier-0`, `/handoff` etc. still
     load (clean shell → SPA boots → routes correctly), no homepage flash.
   - c. Dynamic routes (`/session/:id`, `/share/:id`, `/admin/*`) still work.
   - d. The SPA boots over the prerendered homepage with no visible flash or
     console hydration warning.
   - e. Lighthouse score (the deploy→lighthouse chain records it).

## Sharp edges / notes

- Snapshot is point-in-time: the capacity counter and FeaturedProjects show
  whatever their fetch returned at snapshot time; the SPA re-fetches on boot.
  Acceptable — a split-second of slightly-stale data.
- `theme-bootstrap.js` sets `data-theme` before React; the snapshot captures
  the default theme. Fine.
- The snapshot bakes the post-`useEffect` `<head>` (title, meta description)
  into the static HTML — an SEO bonus.
- `functions/_middleware.ts` injects hreflang into HTML responses; the
  prerendered HTML still flows through it — verify hreflang still injects.
- e2e visual baselines: a prerendered `/` may shift homepage screenshots —
  regenerate baselines (`e2e-snapshots.yml`) if e2e covers the homepage.
- `_redirects` changes production routing — if `dist/app.html` is ever
  missing, deep routes 404 site-wide. Phase 1a (copy app.html first,
  unconditionally) is what guarantees it always exists.

## Order

1 → 2 → 3, then deploy and run Phase 4. Each phase green on `npm run build`.
Treat as its own session: Phase 4 is several deploy→verify cycles, and a
routing mistake here is site-wide.
