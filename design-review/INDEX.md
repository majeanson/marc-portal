# Design Review — Reviewer's Entry Point

This folder is the single entry point for an outside reviewer (claude.ai
with the GitHub connector, or anyone else doing a design pass on this
repo). Everything a reviewer needs to do a useful critique is linked from
here. Anything *not* linked is out of scope for the pass.

If you are the reviewer: read this file in full, then read what it points
to. The expected output format is at the bottom.

---

## What this site is

`marc-portal` (marcportal.com) — a solo Québécois dev's client portal.
React 19 + Vite SPA fronted by Cloudflare Pages Functions on the
backend. Bilingual `fr-CA` / `en-CA` at strict parity. Day + night
themes. The portal sells a *human* practice — visitors should never
pattern-match the site as AI-generated, or the pitch undercuts itself.

The home page is the primary critique target. The other public surfaces
matter less per token spent — read them only if you have budget left.

---

## Screenshots

All baselines live under `e2e/__screenshots__/{viewport}/{name}.png`.
Viewports:

| Folder | Width × Height | Theme |
| --- | --- | --- |
| `wide/` | 1440 × 900 | day |
| `narrow/` | 1000 × 900 | day (tablet / narrow desktop) |
| `phone/` | 390 × 844 | day (iPhone 14) |
| `dark/` | 1440 × 900 | night |

Naming: `/` (FR home) → `root.png`. `/en` (EN home) → `en.png`. Other
routes are slugged from the path (`/intake` → `intake.png`,
`/en/intake` → `en-intake.png`, `/confidentialite` →
`confidentialite.png`).

### Home page — primary critique target

- `e2e/__screenshots__/wide/root.png` — FR, desktop, day
- `e2e/__screenshots__/wide/en.png` — EN, desktop, day
- `e2e/__screenshots__/narrow/root.png` — FR, tablet, day
- `e2e/__screenshots__/narrow/en.png` — EN, tablet, day
- `e2e/__screenshots__/phone/root.png` — FR, mobile, day
- `e2e/__screenshots__/phone/en.png` — EN, mobile, day
- `e2e/__screenshots__/dark/root.png` — FR, desktop, night
- `e2e/__screenshots__/dark/en.png` — EN, desktop, night

### Secondary surfaces (read only if home critique leaves budget)

- Intake — `wide/intake.png`, `wide/en-intake.png`, `phone/intake.png`
- Pricing-driven projects gallery — `wide/projects.png`,
  `phone/projects.png`
- Map — `wide/carte.png`, `wide/en-map.png`
- Auth surfaces — `wide/login.png`, `wide/login-sent.png`
- Legal — `wide/confidentialite.png`, `wide/en-privacy.png`,
  `wide/en-pia.png`

### Screenshots NOT to use

- `wide/parcours.png` / `wide/en-journey.png` — narrative pages, not
  pure UI surfaces.
- Anything under `e2e/__screenshots__/dark/narrow/` or `dark/phone/` —
  these don't exist by design (night-theme bugs are colour/contrast,
  not layout, so only `dark/` desktop is captured).

---

## Component code

The home page is composed top-to-bottom from these components, in this
order. Read in this order if doing a flow critique:

1. `src/components/Hero.tsx` — empathy paragraph + closer + signature +
   live capacity pill. Just redesigned (2026-05-27). Companion doc:
   `src/components/Hero.feature.json` carries the *why* behind every
   decision — read it to understand what was deliberately removed and
   why before suggesting it be re-added.
2. `src/components/HowItWorks.tsx` — three steps.
3. `src/components/BringAnything.tsx` — examples grid.
4. `src/components/About.tsx` — Marc's intro paragraphs.
5. `src/components/Pricing.tsx` — tier ladder + `−20 %` community
   promo line + collapsed FAQ-style notes. Just changed (same date).
6. `src/components/FAQ.tsx` — `<details>` accordion of common Qs.
7. `src/components/Footer.tsx` — build hash, live Quebec clock,
   outbound links.

Shared visual primitives invoked from above (read on demand, not by
default): `src/components/SectionEyebrow.tsx`,
`src/components/PageMast.tsx`, `src/components/FeatureDot.tsx`,
`src/components/CrossFeatureLink.tsx`.

---

## Copy

`src/i18n.ts` is the source of truth. Both languages are in one file
(`DICT.fr` and `DICT.en`); search by section key:

| Section | Key in DICT |
| --- | --- |
| Hero | `hero` |
| How it works | `howItWorks` |
| Bring anything | `bring` |
| About | `about` |
| Pricing | `pricing` |
| FAQ | `faq` |
| Footer | `footer` |

`typeof FR` is a compile-time parity contract — every key in `fr` exists
in `en`. If you suggest a copy change, propose both languages.

---

## Design system

`src/styles.css` is the single stylesheet (no Tailwind, no CSS-in-JS).
Design tokens live at the top under `:root` (day) and
`:root[data-theme='night']` (night). Pricing-related styles start near
the `.tier__` prefix. Hero styles start near `.home .hero`.

---

## Voice rules

The full guide is in `portal/CLAUDE.md`. **Read the two sections titled
"House voice — copy" and "House voice — code" before critiquing.** They
encode rules that look arbitrary but aren't (built up from real wrong
turns). Summary of the most load-bearing rules:

### FR is Québécois, not France

- Lean in: "fait que", "tannant", "céduler", "ben", "pis", "asteure".
- Drop: "alors donc", "kiffer", filler "truc/machin", France-Fr
  "courriel/mail" inconsistency (use **courriel** consistently).
- First-person singular ("je", "moi") is the default. Marc speaks for
  himself.
- French punctuation spacing is rendered via the `frPunct()` helper, not
  literal U+00A0 / U+202F (the build strips those).

### Don't sound AI-generated (FR or EN)

Banned by default (needs an explicit reason if used):

- **Em-dash density.** One " — " per paragraph is fine. Every UI string
  setting off a clause with " — " is the tell.
- **Negation-anaphora.** "Pas X. Pas Y. Un Z." / "Not X. Not Y. A Z."
  Reads as chatbot crescendo. Dissolve into one real sentence.
- **Rule-of-three triads of parallel nouns** ("clarity, honesty,
  follow-through"). Three is fine; flat parallelism is the tell.
- **Hedging filler.** "I'd love to help…", "Let's dive into…", "It's
  worth noting…", "This is a great question." Cut.
- **Marketing superlatives.** "World-class", "best-in-class",
  "industry-leading". A solo dev doesn't claim these.

### Visual tells (just as bad as copy tells)

- Gradient-clipped text (`-webkit-text-fill-color: transparent`).
- Uniform staggered slide-up reveals (reveals here are opacity-only —
  "ink-in", not "fade-up").
- Rounded status-badge pills with a coloured dot. Use the mono ledger
  tag with a filled/hollow square instead.
- Decorative horizontal strokes via `::after`.
- Big floating CTAs with shadow lifts.

---

## Expected output format

A punch list, not encouragement. For each finding:

```
[severity] [screenshot or component path] — one-sentence problem
  fix: concrete CSS/JSX/copy diff (not "consider …")
```

Severity:

- **P1** — ships this week. AI-tell, broken hierarchy, mobile-cramped,
  Québécois-register slip.
- **P2** — nice-to-have refinement that would meaningfully lift the
  page.
- **P3** — ignore unless the file is being touched anyway.

Group findings by surface, not by severity. Start with the home page
desktop flow, then mobile, then dark, then secondary surfaces.

### Critique priorities, in order

1. Visual rhythm of the home scroll as one *flow* (not section by
   section). Where does the eye get tired? Where does it get lost?
2. Anything that pattern-matches AI aesthetics (per voice rules above).
3. Mobile-specific cramping, hierarchy loss, or tap-target issues.
4. Hero specifically — just redesigned, want a stranger's read.
5. Copy lines that read translated rather than written. Especially
   any FR line that sounds like France-French rather than Québécois.

### Don't critique

- CSS architecture or file structure (deliberate single-file).
- Accessibility beyond what shows visually (covered by axe in CI).
- "Should you add Tailwind / styled-components / a CSS framework" — no,
  that's a settled call.
- The map page (`/carte`) layout density — it's a deliberate gallery.
- Operator-only surfaces (anything under `/admin/*` or `/me/*`) — those
  aren't in the home flow.

### Don't pad

No "overall this looks great" preamble. No "let me know if you'd like
me to elaborate" closer. Go straight to the punch list.

---

## A note on freshness

The committed screenshots reflect the state at the commit they were last
regenerated (see `git log e2e/__screenshots__/wide/root.png`). If the
Hero (`src/components/Hero.tsx`) or Pricing (`src/components/Pricing.tsx`)
has been edited since, regenerate via `gh workflow run e2e-snapshots.yml`
on a PR branch and re-pull before doing the review.
