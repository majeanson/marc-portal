# marc-portal — Home Page Design Review Bundle

Self-contained snapshot of everything a design reviewer needs to
critique the home page. No external repo access required.

If you are the reviewer: read this file in full, then read what it
points to. The expected output format is at the bottom.

---

## What this site is

`marc-portal` (marcportal.com) — a solo Québécois dev's client portal.
React 19 + Vite SPA, Cloudflare Pages Functions on the backend.
Bilingual `fr-CA` / `en-CA` at strict parity. Day + night themes. The
portal sells a *human* practice — visitors should never pattern-match
the site as AI-generated, or the pitch undercuts itself.

The home page is the critique target.

---

## Files in this bundle

### Screenshots (`screenshots/`)

The home page in every viewport × language × theme combo we capture:

| File | Viewport | Lang | Theme |
| --- | --- | --- | --- |
| `home-fr-desktop-day.png` | 1440 × 900 | FR | day |
| `home-en-desktop-day.png` | 1440 × 900 | EN | day |
| `home-fr-tablet-day.png` | 1000 × 900 | FR | day |
| `home-en-tablet-day.png` | 1000 × 900 | EN | day |
| `home-fr-mobile-day.png` | 390 × 844 | FR | day |
| `home-en-mobile-day.png` | 390 × 844 | EN | day |
| `home-fr-desktop-night.png` | 1440 × 900 | FR | night |
| `home-en-desktop-night.png` | 1440 × 900 | EN | night |

(Tablet and mobile night-theme screenshots aren't captured by design:
night-theme bugs are colour/contrast not layout, so one viewport is
enough signal.)

### Components (`components/`)

The home page is composed top-to-bottom by these components, in this
order. Read in this order if doing a flow critique:

1. `Hero.tsx` — empathy paragraph + closer + signature + live capacity
   pill. **Just redesigned 2026-05-27.** `Hero.feature.json` is the
   companion design doc — read it to understand what was deliberately
   removed and why before suggesting it be re-added.
2. `HowItWorks.tsx` — three steps.
3. `BringAnything.tsx` — examples grid.
4. `About.tsx` — Marc's intro paragraphs.
5. `Pricing.tsx` — tier ladder + `−20 %` community promo line +
   collapsed FAQ-style notes. **Just changed 2026-05-27.**
6. `FAQ.tsx` — `<details>` accordion of common Qs.
7. `Footer.tsx` — build hash, live Quebec clock, outbound links.

### Copy (`i18n.ts`)

The full bilingual dictionary. `DICT.fr` and `DICT.en` are two parallel
objects with identical keys (compile-time parity contract:
`typeof FR`). Search by section key — the home page uses these:

| Section | DICT key |
| --- | --- |
| Hero | `hero` |
| How it works | `howItWorks` (rendered from `bringAnything` in some places — check the component) |
| Bring anything | `bringAnything` |
| About | `about` |
| Pricing | `pricing` |
| FAQ | `faq` |
| Footer | `footer` |

If you suggest a copy change, propose both languages.

### Design system (`styles.css`)

The single stylesheet (no Tailwind, no CSS-in-JS by design). Design
tokens live at the top under `:root` (day) and
`:root[data-theme='night']` (night).

Useful selectors to search for:

- `.home .hero` — hero container and its inner pieces
- `.hero__manifesto`, `.hero__closer`, `.hero__sig*` — hero text
- `.section`, `.section--alt`, `.section--editorial` — section chrome
- `.tier__*` — pricing tier cards, the new `tier__promo`, and the
  `tier__more` disclosure
- `.faq__*` — accordion
- `.site-footer__*` — footer

The file is ~11K lines. Don't read it whole — search for the selector
you care about.

### Voice rules (`voice-rules.md`)

**Read this before critiquing.** Encodes the FR-Québécois register
and the anti-AI-tells rules (em-dash density, negation-anaphora,
gradient text, status pills, etc.) that are non-obvious and
non-negotiable. A critique that ignores these will get pushed back.

---

## Expected output format

A punch list, not encouragement. For each finding:

```
[severity] [screenshot or component path] — one-sentence problem
  fix: concrete CSS/JSX/copy diff (not "consider …")
```

Severity:

- **P1** — ships this week. AI-tell, broken hierarchy, mobile-cramped,
  Québécois-register slip, accessibility-affecting visual issue.
- **P2** — nice-to-have refinement that would meaningfully lift the
  page.
- **P3** — ignore unless the file is being touched anyway.

Group findings by surface, not by severity. Start with the home page
desktop flow, then mobile, then dark, then any cross-cutting notes.

### Critique priorities, in order

1. Visual rhythm of the home scroll as one *flow* — not section by
   section. Where does the eye get tired? Where does it get lost?
2. Anything that pattern-matches AI aesthetics (per voice-rules.md).
3. Mobile-specific cramping, hierarchy loss, or tap-target issues.
4. Hero specifically — just redesigned, want a stranger's read.
5. Copy lines that read translated rather than written. Especially
   any FR line that sounds like France-French rather than Québécois.

### Don't critique

- CSS architecture or file structure (deliberate single-file).
- Accessibility beyond what shows visually (covered by axe in CI).
- Whether to add Tailwind / styled-components / a CSS framework — no,
  that's a settled call.
- Anything not in this bundle.

### Don't pad

No "overall this looks great" preamble. No "let me know if you'd like
me to elaborate" closer. Go straight to the punch list.
