# PLAN_TOMORROW — from polished to OOMPPH, lucrative, simple

> Written 2026-05-15 (late). Audit pass over the portal codebase + recent git history.
> Read this cold in the morning. Pick *any* item — they're self-contained.
>
> **Where you actually are:** The technical foundation is excellent. `AUDIT.md` shows
> ~40 P1/P2/P3 items shipped this week (CSRF, capacity-cap race, Sentry+Loi 25 PIA,
> hreflang via middleware, scrubber a11y, magic-byte upload validation, audit log
> filters, etc.). 174 tests pass. Strict TS. Boring-tech mandate honored.
> The portal is *better engineered than 95% of $50k SaaS*.
>
> **What this plan is about:** The next layer. Five gaps that aren't engineering:
> 1. **OOMPPH** — the portal is tasteful but lacks a signature visual moment that screams "not another agency" from a Slack unfurl. Fixable.
> 2. **Completeness** — the visitor journey closes well; the *operator's* journey and the *post-shipment* journey both have unclosed loops.
> 3. **Creative leverage** — the LAC ecosystem context, the 1-active-at-a-time constraint, and the bilingual Quebec angle are three unique assets that the current site barely leans into.
> 4. **Lucrative** — zero of the displayed tier prices is currently payable on-site. Stripe is a stub. The custodian-mode $200/yr is described but not subscribable. The white-label / template / book / referral revenues are all sitting on the floor.
> 5. **Simple to operate** — daily reply-triage, advancement-posting, and showcase-publishing each cost more clicks than they should. The "1 active + 1 triage" promise is brilliant *as a constraint* and brutal *as a workflow* unless the admin surface is built for batching.

---

## TL;DR — six things, then read on if you want

If you only have 60 minutes tomorrow, do **#1**. If you have a day, add **#2** and **#3**.
If you have a week, add **#4–#6**.

1. **Wire Stripe Checkout on Tier 1 / Tier 2** so visitors can pay the displayed prices without an e-Transfer dance. Self-serve renewal for the `$200/yr` custodian mode. This single change converts "polished landing page" → "operates revenue." See [§5.1](#51-stripe-checkout-on-tier-1--tier-2-deposit).
2. **Add a signature visual to the OG card + hero** — a hand-stamped/napkin element that travels with every share. Today the cards are *good but generic-editorial*. The Napkin + Scrubber are your distinctive components; pull them into the marketing surface. See [§2.1](#21-the-signature-visual-the-napkin-stamp).
3. **Productize one thing: the SND template ($99) on Gumroad.** You've already built the demo, the parser, and the audio. Three days to ship a buyer-installable Cloudflare Pages template. Validate that the "I'd buy this" comments are real money. See [§5.3](#53-productize-the-snd-template-on-gumroad-99).
4. **Build the "batch reply" admin screen** so a Sunday-evening triage pass takes 5 minutes instead of 25. See [§6.1](#61-batch-reply-admin-screen).
5. **Surface the portal's own `feature.json` files as a public meta-section** — "this app, documented in public, in its own LAC format." Free SEO + the deepest moat you have against generic competitors. See [§4.1](#41-the-portal-documents-itself-public-lac-meta).
6. **Decide the fate of buyer-admin / Fleet / Tenant code.** Either delete (cleanliness) or productize as a white-label template. The bmad audit said "keep as scaffolding"; the cost is real audit-surface and cognitive load. See [§3.4](#34-decide-the-fate-of-the-buyer-admin--fleet-code).

---

## 0 — Honest read on current state

### What's genuinely great (don't touch)

- **Voice** — "Pas une agence. Pas une plateforme. Un humain qui décide, une machine au milieu." That pull-quote is doing 30% of the marketing work alone. Same for "1 projet actif + 1 en triage" — that's a defensible constraint *and* a memorable line.
- **Folio + editorial scaffold** — `№ 01`, Roman folios (IV), section eyebrows in mono, balanced text-wrap on h1/h2. The atelier feel is real.
- **Cream paper + sage + warm-amber accent + dusty-blue cool** — a coherent palette across light/dark. Night-mode portrait filter, paper grain dimming, sticky-header re-tint — this is craft-level CSS.
- **Time-travel scrubber** + **Napkin (Excalidraw)** + **`/me` self-export (Loi 25)** + **handoff modes page** + **`/tier-0` self-serve patterns** are all distinctive components. None of them are generic.
- **The bilingual FR-CA / EN-CA experience.** Per-page OG image, locale detection, `mp_lang` cookie, hreflang via middleware. Most bilingual sites do this badly.
- **The capacity-cap race fix** (atomic UPDATE with cap-folded subselect) is the kind of code that prevents the 11pm incident you couldn't recover from.
- **The Sentry + Loi 25 PIA pattern** is the right template for any future third-party processor (already a saved memory).

### What's quietly weak

- **The Pricing tiers are a clean list, not a menu.** The "atelier" vibe doesn't reach the cards — they're typographic but feel like a SaaS pricing block. (See [§2.3](#23-pricing-as-a-printed-menu).)
- **The OG card is *too clean* — text-only.** No Marc, no napkin, no Quebec marker. Slack-unfurled, it looks like any well-typeset blog landing page. (See [§2.1](#21-the-signature-visual-the-napkin-stamp).)
- **The Hero CTA area is dense.** Big display headline + lead + body + facts list + ToC + capacity counter all stacked. The hierarchy is fine, but nothing pulls the eye past the headline. (See [§2.2](#22-hero-tightening--one-thing-the-eye-lands-on-after-the-display).)
- **Buyer-admin / Fleet / Tenant code is in the tree but not in the sidebar.** Bmad's 2026-05-09 decision: *keep as scaffolding, don't market.* That decision is 6 days old and was made before this audit pass — it can be revisited. (See [§3.4](#34-decide-the-fate-of-the-buyer-admin--fleet-code).)
- **AdminBilling is a stub saying "Stripe arrive bientôt".** That stub has been there since Phase 1. Either delete and stop saying it (false promise to clients) or actually wire it.
- **The "1-active rule" is enforced server-side now (great), but it's not *visible* on the marketing surface.** The capacity counter is on the hero — but a public "next slot opens around July 12" date would be far more visceral. (See [§4.4](#44-the-public-capacity-calendar).)
- **No reviews, testimonials, or social proof anywhere.** "I read every form myself" is great, but the next sentence the visitor wants is "and three other people have already paid me for it." (See [§3.5](#35-social-proof--the-shipped-wall).)
- **No referral mechanic.** When you're at cap, you say "join the waitlist." A "while you wait, here are 3 other Quebec solo devs I trust" page would turn waste into either revenue (finder's fee) or pure goodwill (still wins). (See [§5.5](#55-referral-page-when-at-cap).)
- **No newsletter / no follow-on motion.** Once a visitor closes the tab, they're gone. A *"once a month, only when something shipped"* email is one form field on the homepage. (See [§4.5](#45-once-a-month-only-when-something-shipped-newsletter).)

---

## 1 — Five big bets (if you only do five things this quarter)

These are the moves that, if they land, the next conversation is "how do I scale this" rather than "is this working." Each links to its own section.

| #   | Bet                                                  | Cost (you) | Lever                                          |
| --- | ---------------------------------------------------- | ---------- | ---------------------------------------------- |
| B1  | Stripe Checkout + custodian subscription             | ~2 days    | Converts displayed prices to actual cash flow  |
| B2  | Signature OG + napkin-stamp brand element            | ~half day  | Every Slack/iMessage share now does work       |
| B3  | One productized SaaS-y artifact (SND template, $99)  | ~3 days    | Validates a side-revenue stream                |
| B4  | Public LAC meta page (portal documents itself)       | ~half day  | SEO + moat + dev-audience attractor            |
| B5  | Batch-reply admin + advancement-from-deploy automation | ~1.5 days  | Cuts daily ops time by 60–80%                  |

If you can only do **one**: B1. The site is leaving money on the floor every day it's not.
If you can only do **two**: B1 + B2. (Cash + brand in one half-week.)

---

## 2 — OOMPPH: visual identity, distinctive moments

The portal is well-typeset. It is not yet *memorable* in the way that, say, [stripe.com](https://stripe.com) or [linear.app](https://linear.app) or [pinboard.in](https://pinboard.in) (different end of the spectrum, same principle) are memorable.

### 2.1 The signature visual: the napkin stamp

**Goal:** Every Slack/iMessage/LinkedIn unfurl shows something that says "this is Marc, not another agency" in 0.5 seconds.

**Current state:** `og-image.svg` is a clean cream gradient + sage accent + 3-line typographic statement. Per-locale (FR / EN PNGs). Good but lacking *one* visual hook.

**Concrete options:**

- **(a) Hand-stamped "VÉRIFIÉ EN QUÉBEC" mark** — a tilted rubber-stamp graphic in the bottom-right of every OG card. Same stamp lives on `/me`'s receipt pages, on email footers, on the `v1.0-handoff` git tag commit message. Becomes the visual signature.
- **(b) Napkin-corner element** — bottom-right of the OG card shows a 3-line Excalidraw-style sketch (box + arrow + word). Different sketch per locale or per project. The "napkin" component is already your most distinctive UI element; pull it into the marketing surface.
- **(c) Marc-as-stick-figure mascot** — a tiny crouched-at-laptop figure in the corner of every OG. Same figure waves on `/me` empty state, holds up a 🛠 on triage notifications. Caveat: requires you to like drawing. If you don't, skip.

**Recommended:** (a) + (b) combined. Stamp on the home OG, napkin on per-session share cards. The `/og/share/:id` endpoint already generates per-session cards via satori — you can render an Excalidraw scene preview into the card if the session has a napkin attached. Tightens the brand loop end-to-end.

**Work breakdown:**

- Design the stamp in Figma (or hand-draw + scan) — 1h.
- Add it as an SVG layer in `public/og-image.svg` + `og-image-en.svg`, regenerate PNGs via `scripts/build-og-image.mjs`. The hash-drift check (`P3.20`) catches you if you forget to regenerate. — 1h.
- Add to `functions/og/share/[id].ts` (workers-og / satori) as a corner element. — 2h.
- Add as a tiny watermark in the `<Footer>` and on the printable handoff checklist. — 30min.

### 2.2 Hero tightening — one thing the eye lands on after the display

**Current:** Display headline → `body2` lead → `body1+body3` meta paragraph → CTA → 4 facts list → bilingual line → CapacityCounter → ToC. That's eight visual elements before the visitor scrolls.

**Issue:** No element after the display headline says *"start here"* with conviction. The CTA is text-button-sized; the facts list is monospace and reads as fine print; the ToC is helpful but signals "long page ahead" rather than "click me now."

**Concrete moves:**

- **(a) Promote the CTA visually.** Today `.hero__cta` is a styled `<a>` with a hover translate-X on `::after`. Bump it to a larger, slightly elevated card with the SLA pill ("Réponse honnête en 72h") inside the button rather than as a fact-item below. — 30min.
- **(b) Demote the ToC to a hover-revealed side rail.** It's already duplicated by `SectionRail`. Pulling it out of the hero gives the headline room to breathe. — 30min.
- **(c) Inline the SND audio preview.** The bmad audit's highest-leverage item was "inline the SND demo on the homepage." Audio files now exist (`public/audio/snd-{tuesday,thursday,friday}*.mp3`). A 90-second hero-section embed with one "play" button per voice note makes the demo *immediate*. (See [§3.3](#33-inline-the-snd-audio-on-home).) — 2h.
- **(d) Add a single secondary CTA: "voir un projet en cours →"** linking to the most-recent showcased session's `/share/:id` page. Today the only path is "submit your problem"; the "I just want to peek" visitor has no front door. — 15min.

### 2.3 Pricing as a printed menu

The current pricing block is `<ol class="tiers tiers--menu">`. The class is called *menu* but the layout reads as cards.

**Push it further toward "diner menu" / "printed wine list":**

- Right-justify the price, dotted leader between scope and price (like a menu price line: `Petit projet simple . . . . . . . . . . . . . . ≈ 300 $`).
- Strike-through the previous tier as the visitor's eye rises (CSS-only — toggle on viewport scroll); creates a "trade-up" feel.
- Put the recommended-tier ribbon ("Le bon point de départ") at a 4° rotation, sage on cream, like an actual printed stamp.
- Add a "menu folio" element above the prices: `IV — Prix publics, en vigueur depuis 2026-01-15.` Treats the price list as a versioned document. (You already have `asOf` in the Handoff page — same pattern.)
- Footer of the price block: a small disclaimer in the same voice as the `asOf` line — "Les prix peuvent bouger. Toujours négociables, jamais surprises."

**Why this works:** Your competitor in the visitor's head is "the agency" (vague, contact-us, scope-creep). Reading a menu — final, signed, posted on the wall — is the opposite emotional posture. The CSS is small. The effect is large.

### 2.4 Motion: less, but signature

Audit the existing motion:
- `@keyframes hero-rise` — display line entrance ✓
- `@keyframes hero-mark-draw` — emphasis underline draw ✓
- `@keyframes editorial-rise` — section entrance ✓
- `@keyframes route-fallback-shimmer` / `portal-skeleton` / `card-skeleton-shimmer` — loading states ✓
- `@keyframes share-modal-fade` — modal entrance ✓

What's missing:

- **A success animation.** When the visitor submits an intake (`Confirmation.tsx`), the eyebrow flips to `reçu` but there's no *moment*. A single ink-stamp animation (a transparent SVG of the stamp, scaling from 1.4→1.0 with rotation, drop-shadow softening) on confirmation would be the brand-defining microinteraction. Plays once, respects `prefers-reduced-motion`. — 1h.
- **Capacity meter "tick".** When `CapacityCounter` flips from `1/2` to `2/2`, animate the second dot filling in. Same when a slot opens. Real-time visceral. — 30min.
- **Sound (optional, off by default).** A single soft chime on intake submission, on advancement publish, on handoff completion. Behind a `mp_sound=1` cookie or a user-preference toggle. Most sites don't do this — yours can, with restraint. — 1h.

### 2.5 The 404 / error / empty states

These are where brands either consolidate or fall apart.

- **`NotFound.tsx`** — copy is fine, missing visual. Add the napkin stamp + a hand-drawn arrow scribble pointing at the "back home" link. — 20min.
- **`RouteError.tsx`** — same treatment. The "quelque chose a planté" is the right voice; lean in further with `<details>` containing the error message (collapsed) for the curious dev visitor. — 20min.
- **`FeaturedProjects` empty state** — already styled. Good. Leave alone.
- **`/projects` empty state** — has `placeholderEyebrow: 'votre projet ici'` — good copy, but the rendering is missing this section because there's only a top-level `empty` string. Add a "votre projet ici" placeholder card at the end of the gallery as a visitor-conversion device. — 30min.
- **`/admin/inbox` empty state** — likely just shows "Aucune session." (admin doesn't need to be marketing'd, but a *useful* empty state — "Tu peux te détendre" — protects the family-time brand even internally). — 20min.

### 2.6 The brand glyph

Currently the brand is the word `marc.portal` with a sage dot. The dot is doing all the heavy lifting.

Consider a **monogram glyph** — `M·P` or just `M` — set in Source Serif 4, embossed/letterpress feel, used in:
- The favicon (currently `favicon.svg` — check it; if it's the dot variant, evolve it).
- A 64×64 spot on `/me` (the visitor's "console" feels institutional).
- The OG corner element (alongside the stamp).
- The handoff git tag's commit signature.

Don't go overboard. *One* well-set serif initial is more memorable than a custom logotype.

---

## 3 — Completeness: closing the unclosed loops

### 3.1 Post-shipment visitor journey

**The gap:** After a session moves to `shipped`, what does the visitor see when they log into `/me`? Today: the session is just there with a "shipped" status badge. Nothing celebrates the moment. Nothing converts a shipped client into a referrer.

**Add:**
- A **"Felicitations" moment** on the session page when status flips to `shipped` — the brand stamp animation from §2.4, plus a one-paragraph note from Marc that's actually a templated field on the session.
- A **"share this with someone who needs it" CTA** that surfaces the public `/share/:id` link with a pre-written tweet/Facebook share. — 1h.
- A **"refer a friend" mechanic**: visitor enters an email; if that email signs up and converts within 90 days, the referrer gets $50 off their next engagement OR sits at the top of the next-slot waitlist. Both you and them know it's not spammy because it's gated to *one* friend per shipped session. — 4h (D1 table + cron sweep).
- A **"how it ended" written debrief** that lives on the public `/share/:id` page. Two paragraphs: what shipped, what's measurable about it. You're already writing this in the engagement thread; surface it as a public summary.

### 3.2 The visitor at "I just want to peek" mode

**Current paths:** `/` → `/projects` → `/share/:id` (per project) or `/tier-0` (free patterns). All require knowing to look.

**Add:**
- A **"5-minute tour"** page (`/tour` / `/en/tour`) that walks a non-buyer through: the intake form (read-only sample), the engagement thread (real example), the time-travel scrubber on a shipped project, the handoff page. Quick, copy-driven, no commitment. — 4h.
- **`/projects` should default to "shipped" filter**, with a clear toggle to see active ones. Today the visitor lands on a mixed bag.
- **A "what's new" stream** on the home page, between Hero and HowItWorks: latest 3 advancements across all public sessions, with timestamps. Live build-in-public surface. — 3h.

### 3.3 Inline the SND audio on home

The bmad 2026-05-09 audit flagged this as the highest-leverage 4-hour block in the entire backlog. Audio files now exist. Move it back onto the roadmap.

**Concrete:**
- Below Hero (or as part of Hero), render a small 3-clip player (no need for the full SndDemo experience — just the audio + transcripts + the "→ becomes this invoice" reveal).
- Reuses `src/pages/SndDemo.tsx` logic; extract a `<SndPreview compact />` component.
- Adds the *single most powerful "show, don't tell"* moment on the homepage. — 2-3h.

### 3.4 Decide the fate of the buyer-admin / Fleet code

**What's there:**
- `src/pages/AdminFleet.tsx`, `AdminFleetNew.tsx`, `AdminBilling.tsx`, `AdminTeam.tsx`
- `src/pages/SndApp.tsx`, `VolunteerApp.tsx`, `RootByTemplate.tsx` (per-template buyer-facing apps)
- `functions/api/admin/fleet/`, `functions/api/tenant.ts`, `functions/api/tenant/`
- `feat-fleet-foundation/`, `feat-platform-spine/`, `feat-runtime-theme-editor/`, `feat-custom-domain-onboarding/`, `feat-buyer-admin/`, `feat-operator-console/`, `feat-template-snd-package/`, `feat-template-volunteer-roster/`

**Bmad's 2026-05-09 verdict:** "keep as scaffolding, don't market." That was a reasonable call but it has costs:

- Audit surface (every commit you make has to consider these surfaces).
- Cognitive load reading the codebase (future-you / Claude in 6 months).
- The `AdminBilling` stub literally says "Stripe arrive bientôt" — a *false promise* to anyone who lands there.

**Three honest paths forward:**

- **(a) DELETE.** Remove all buyer-admin / fleet UI + the routes. Keep the tenant resolution middleware (it's cheap, no UI). The `template_id` column stays on `sessions` (already used for the SND template-selector pattern). You lose nothing visitor-facing. — 4-6h.
- **(b) HIDE (current state) but add a comment + tracking issue.** Add `feat-buyer-admin/feature.json` `status: "frozen"` with a clear note. Means future-you doesn't waste time on it.
- **(c) PRODUCTIZE.** Turn the buyer-admin into a *paid* offer: "buy a copy of my exact portal, I install it on your domain, you operate it for your own side-practice. $999 setup + $99/mo hosted, or $499 self-hosted template." This is the white-label-portal play — and the buyer-admin code is genuinely 70% built. The reason bmad rejected this was "not a marketplace" — but a *one-time-template-sale* is not a marketplace, it's a productized service. (See [§5.4](#54-the-white-label-portal-template-pay-once-self-host).)

**Recommendation:** (c) if you want one new revenue line this quarter, (a) otherwise. (b) is "I'm tired and don't want to decide" — fine but choose explicitly.

### 3.5 Social proof — the shipped wall

You currently render 0–N showcased projects on `/projects` and the top 3 on home (`FeaturedProjects`). What you don't render:

- **Counter:** "12 projects shipped since 2026-01" — a Live D1 query.
- **Testimonials/quotes:** one line per shipped session, picked by Marc, displayed in a marquee or grid above pricing.
- **The "before / after" pull:** for each shipped session, the visitor's *original intake one-liner* next to the *shipped one-liner*. Powerful — shows the transformation.
- **Map:** if 3+ projects ship in different Quebec regions, a simple SVG map of Quebec with dots. (Don't build until you have the data.)

### 3.6 Mobile audit

`MobileStickyCta` exists. Hero is `clamp()`-sized. Theme toggle is small. Status — likely OK.

But three specific places to verify:
- **Pricing tiers on 360-wide mobile** — the dotted-leader menu treatment from §2.3 needs to gracefully wrap or stack.
- **Scrubber on mobile** — the time-travel scrubber's keyboard hint reads weird on touch.
- **Napkin on mobile** — Excalidraw on a 5" screen is fiddly. Detect touch + suggest "describe instead of draw" or simplify to a 3-tap "box → arrow → label" mode.

— 4-6h total to do all three properly.

### 3.7 Accessibility — non-trivial gaps

You already have skip-to-content, semantic landmarks, `aria-describedby` on the scrubber, role buttons. What's likely thin:

- **Screen-reader announcements when capacity flips** (live region).
- **Keyboard escape from modals** (`ShareModal` — verify focus trap + ESC).
- **Focus visible on `.hero__cta`** — does it have a visible non-color focus indicator? Cream-on-sage may not meet WCAG AA without an outline.
- **Color-contrast spot-check** in night mode — `text-faint` (`#5e574d`) on `bg` (`#181613`) is borderline. Validate with axe DevTools or `colorable`.

— 1-2h to fix.

### 3.8 The handoff page checklist printability

`/handoff/checklist` is referenced in the Handoff page. Verify:
- Print stylesheet exists (`@media print`).
- The checklist is sane on letter-sized paper.
- The brand stamp / monogram appears in print.
- The dormancy procedure (the "Marc disappeared" section) is visible without log-in.

The whole point of this page is that a stressed client can print it and feel safe. If print mode is broken, the page is theatre.

— 1h.

---

## 4 — Creative / out-of-the-box leverage

These are the moves nobody else in your peer group will think to make. They're cheap *because* they're weird; they compound *because* they make the portal un-cloneable.

### 4.1 The portal documents itself — public LAC meta

**The asset:** You have ~25 `feat-*/feature.json` files at the repo root. Each is a structured, schema-validated document about a feature: what, why, decisions, success criteria, status history, known limitations. This is *exactly* what the LAC ecosystem (your own product) is designed to surface.

**The move:** Add a public route — `/meta` or `/sous-le-capot` — that renders the portal's own feature.json files as a public page:

- Eyebrow: `méta · le portail, raconté par lui-même`.
- A 2-paragraph framing: "Ce portail utilise mon propre outil (LAC) pour documenter ses propres décisions. Voici ce que ça donne en pratique."
- A grid of feature cards (status, name, why, decisions count, links to the feature.json on GitHub).
- A "freshness" indicator on each: green = updated < 30d, amber = 30-90d, red = > 90d.
- Link to the LAC ecosystem / `lac-cli` for visitors who want the tool.

**Why it works:**
- **SEO:** Quebec dev shop, public engineering log, "build-in-public" — narrow long-tail keywords with very low competition.
- **Moat:** No other solo-dev portal *can* clone this without adopting your own ecosystem first. Defensive asset.
- **Dev-audience attractor:** The kind of visitor who's going to buy your future $99 book is the kind who reads `/meta` pages.
- **Synergy:** The lac-mcp server already has `roadmap_view`, `audit_decisions`, `feature_changelog` tools — they were built for this. Use them at build time to render the static page; no runtime cost.

— 4-6h (mostly write-up + a build script that reads `feat-*/feature.json` and emits a static MDX/JSON file the page consumes).

### 4.2 The "live engineering log" — auto-advancement on deploy

Today, when a deploy ships, Marc manually creates an "advancement" on the relevant session. (`SessionAdvancements.tsx` has a form.)

**The flip:** A GitHub Action that — on every successful `main` push — POSTs to a new `/api/admin/advancement-from-deploy` endpoint with `{ commit, branch, buildUrl, files-changed }`. The endpoint:
- Looks up which `feat-*/` directories were touched.
- Finds sessions tagged with those feature IDs (new optional `session.feature_ids` field).
- Creates a draft advancement on each, with a 24h "publish or auto-discard" lifetime.
- Sends Marc one summary email per deploy.

**Result:** Build-in-public happens automatically. Marc just clicks "publish" (or ignores; auto-discards in 24h).

— 6-8h, but each future deploy generates a marketing artifact for free.

### 4.3 Voice intake — visitors record a 30-sec audio

**Current:** Intake is text + napkin sketch. Beautiful.

**Add:** A third optional input — "press to record 30 seconds explaining your problem in your own voice." Stored in R2 as audio. Played back in `/admin/inbox` so Marc hears the visitor's actual voice, accent, urgency before reading.

**Why:**
- Quebec audience often more comfortable *speaking* than writing English/French neutrally.
- "I read every form myself" upgrades to "I read and I listen" — strictly more human.
- Audio compresses smaller than rich text; even at 64kbps mono, 30 sec is ~240 KB.

**Implementation:** Web Audio API `MediaRecorder` → `audio/webm`. Reuse the attachment upload path (R2, magic-byte validated). One new field, maybe 3h with polish.

### 4.4 The public capacity calendar

**Current:** `<CapacityCounter>` shows "1 actif · 1 triage" or similar.

**Bigger move:** A small calendar widget on the home page showing the *next 12 weeks* with each week colored:
- Green = available.
- Sage = booked.
- Cream = waitlist-only.
- A "next open slot" pill below: *"prochaine ouverture : ~12 juillet 2026"*.

Computed from current sessions + your standard cadence (`avg shipped_at - active_started_at` from D1). Renders client-side from `/api/capacity-calendar`. Live, public, real.

**Why:** "Plus une plateforme, un humain" sells *much* harder when the visitor can see your actual calendar. Reduces anxiety about waitlist ("oh, only 4 weeks") or accelerates urgency ("better book now, August is the next opening").

— 6h.

### 4.5 "Once a month, only when something shipped" newsletter

**The form:** One email field on the home page footer. Single button.
**The content:** A monthly (or less!) email — fires only when there's a `shipped` session that month. Otherwise stays quiet. Body: 1 paragraph on what shipped + 1 paragraph on what's in flight + 1 link.

**Why this works:**
- **Honest** — you don't spam.
- **Brand-aligned** — the "respect your inbox" motion mirrors the "no calls, no meetings" pitch.
- **Compounding asset** — every visitor who liked the site but isn't ready *now* converts later.

**Implementation:** New `newsletter_subscribers` D1 table. Resend audience. A digest cron checks for `shipped_at IS NOT NULL AND shipped_at > last_newsletter_at`. Manual approval gate before sending (Marc reviews + edits before fire). — 4-6h.

### 4.6 Quebec micro-moments

Your audience is specifically Quebec-side. Lean into it:

- **Currency formatting** — the bmad audit flagged `≈ 300 $` (space + dollar after) which OQLF actually requires. Spot-check `i18n.ts` keys and `SndDemo.tsx`.
- **Local examples** — the SND demo uses fictional Tremblay / Bouchard / Côté names. Continue this discipline across all examples — never a "John Smith" anywhere. If a visitor lands and sees a familiar Quebec surname, conversion goes up.
- **Public holiday banner** — auto-show during construction shutdown (last two weeks of July): "Je suis en vacances de la construction comme tout le monde. Reviens en août." That single banner is the most Québec thing you can put on a website.
- **OQLF-compliant fine print** — already in the footer. Consider expanding: "Hébergé au Canada · Loi 25 · OQLF · pas une agence" all on one line.
- **Acceptance of e-Transfer** as a payment method alongside Stripe — most Quebec micro-businesses prefer it.

— 2-3h scattered.

### 4.7 The "Marc's commute" angle (storytelling)

Long shot but cheap: a short prose paragraph somewhere about *when* you work on the portal — "le soir, après que les enfants dorment, entre 21h et 23h." Adds a temporal humanity element. Could rotate the OG card eyebrow per time of day (`"écrit à 22h47, mardi"`). Weird, charming, defensible.

— 30min.

### 4.8 The annual "year-in-review" page

At year-end, generate a single static page: "2026 — what shipped." Counter, projects grid, top decisions, total intake count, accepted rate, average response time. Public. Shareable.

You already have all the data — it's in D1 + the `feat-*/feature.json` files. A script that reads everything and emits a static MDX page on Jan 1 each year. Zero ongoing cost; one of the most-shared artifacts you'll have. — 4h on Dec 30 of each year.

### 4.9 AI-assisted intake clarification (without breaking "no AI between us")

**The promise you made:** "Je lis chaque formulaire moi-même — pas d'IA entre toi et moi."

**The compatible AI move:** Run a *private* LLM pass on each intake that *Marc sees but the visitor doesn't*. Output: a 3-line suggestion to Marc — "this looks like a Tier 1, suggest you respond with X template, watch out for Y." Marc still reads, still decides, still writes the reply. The AI accelerates *Marc's reading*, not the visitor's experience.

**Why this is safe:** Promise preserved (no AI between Marc and visitor). Operational time cut significantly.

**Implementation:** Add a `/api/admin/inbox` enrichment that calls Claude Haiku (or OpenAI gpt-5-nano) for each new intake. Cache result on the row. Renders as a collapsed "AI hint (private)" in `/admin/inbox`. Costs ~$0.001 per intake. — 4h.

### 4.10 The "1-foot-of-rope" anti-pattern banner

You already document P1 / P2 / P3 in `AUDIT.md` with the "one-foot-of-rope" definition. That's *brand* — that's how a senior engineer talks. Carry it onto the public site somewhere subtle. A small `<details>` in the About page: "How I think about prod risk." Three paragraphs. The kind of post that gets HN-shared.

— 1h.

---

## 5 — Lucrative: money the portal isn't currently making

### 5.1 Stripe Checkout on Tier 1 / Tier 2 deposit

**Problem today:** Visitor sees `≈ 300 $` / `≈ 1 500 $`. Decides yes. Now has to wait for an e-Transfer instruction email from Marc. Friction.

**Solution:**
- After Marc accepts a session (status → `active`), an automated email goes out with a Stripe Checkout link for either the full Tier 1 amount or a 50% deposit on Tier 2.
- Stripe Checkout collects CAD with TPS/TVQ split automatically (Stripe Tax handles this in QC).
- On payment success, the session row gets `deposit_paid_at` set; the visitor sees a "paiement reçu" pill in `/me`.
- On no payment in 72h, an auto-reminder. After 7 days no payment, status reverts to `triage` with a soft note from Marc.

**Why this matters:**
- Converts displayed prices to actual cash flow.
- E-Transfer stays as a fallback ("préfères Interac? écris-moi").
- The friction-removal is the single biggest revenue lever the site has.

**Work:** ~2 days.
- Stripe account setup + Tax registration in QC: half-day.
- D1 schema: `deposit_paid_at`, `deposit_amount_cad`, `stripe_checkout_session_id`, `stripe_charge_id`: 30min.
- New `/api/payments/checkout` (creates session) + webhook handler `/api/payments/webhook`: half-day.
- UI on `/me` (the "paiement attendu" / "paiement reçu" pill) + admin view: half-day.
- Email templates: 1h.

**Sentry + Loi 25 considerations:** Stripe is a third-party processor — apply the same pattern saved in memory (`project_loi25_sentry_third_party_processor_pattern`): PIA addendum for Stripe, privacy-page disclosure, code minimization (don't send `customer.email` to Stripe — let them ask for it themselves), RUNBOOK section. ~2-3h additional but template'd from Sentry.

### 5.2 Self-serve custodian-mode subscription

**Promise on the Handoff page:** "$200/year covers domain + 2h/month of tweaks."

**Reality today:** Manual. Marc would have to invoice them annually.

**Move:** A `/me/billing` page where the visitor can:
- See their custodian status (active / not subscribed).
- Subscribe via Stripe Subscriptions ($200/yr, auto-renewal).
- Cancel anytime ("le mode bascule vers 'tout à toi'" — already documented behavior).
- See the year's used-tweak-hours counter.

**Why:** Recurring revenue is the holy grail for a side-practice — predictable, low-touch, "money while you sleep." Even at 5 custodian clients × $200 = $1k/yr recurring with near-zero ops.

**Work:** ~1 day, follows directly from §5.1 (same Stripe integration).

### 5.3 Productize the SND template on Gumroad ($99)

**The asset already built:**
- `feat-template-snd-package/` directory.
- `SndApp.tsx` (the buyer-facing version of the demo).
- The parser (`src/lib/sndParser.ts`).
- The audio files.
- A working invoice-generation flow.

**Productize as:**
- A downloadable zip: source + setup README + Cloudflare Pages deploy button.
- Buyer follows: deploy → set Resend API key → configure Quebec tax rates → done.
- Single sale: $99 CAD on Gumroad / Lemon Squeezy.
- Optional add-on: "$199 — I install it for you on your domain."

**Why:** Validates "do people pay for things like this?" without committing to a full multi-tenant SaaS. The product is the *exact* artifact you already built — no incremental engineering.

**Work:** ~3 days.
- Polish `SndApp.tsx` for genericity (parameterize trade type — plumbing / electrical / framing / landscaping): half-day.
- Write a 5-page setup README with screenshots: half-day.
- Make the Cloudflare Pages "Deploy" button work (button-spec in the README): half-day.
- Record a 3-minute setup video: 1h.
- Gumroad listing copy + screenshots: half-day.
- Pricing page entry: a 4th tier card — "Tier 0.5 — autonome (le template, à toi de l'installer) — 99 $".

**Conservative revenue forecast:** 5 sales/year × $99 = $495. Realistic if shared in /r/quebec, /r/sidehustle, FB Marketplace Québec.

### 5.4 The white-label portal template (pay once, self-host)

This is the productization of the buyer-admin / fleet code from §3.4.

**Offer:** "Your own portal, just like Marc's, on your own Cloudflare account."
- $999 CAD one-time: Marc clones the repo, white-labels (brand colors, name, copy), deploys it on the buyer's Cloudflare, hands them the keys.
- $499 self-install: buyer gets the repo + a 30-page setup guide.
- $99/mo "monthly debrief" optional add-on: buyer joins a small Discord, gets answers to questions, sees Marc's monthly digest first.

**Target market:** Other Quebec / Canadian solo devs who watch Marc's site, think "I want this for my practice," and have $500 to spend.

**Why this is *not* a marketplace** (bmad's concern): Each sale is a one-time service. No multi-tenant infrastructure for *Marc* to maintain. Each buyer runs their own copy. Marc's portal stays solo-tenant.

**Work:** 1 week, including the template polish, the deploy script, and the documentation. Heavy front-loaded; near-zero recurring cost.

### 5.5 Referral page (when at-cap)

**Current at-cap behavior:** "Tu peux quand même soumettre — liste d'attente."

**Add:** Above the waitlist message, a hand-curated list of 3-5 Quebec solo devs Marc trusts, each with a one-line pitch and an external link. Format: like the Tier 0 patterns — clean, list-style, no fanfare.

**Two arrangement options:**
- **Goodwill** — purely altruistic. Each referred dev sends one back when they're at cap. Network grows.
- **Finder's fee** — each conversion pays Marc $50 or 5% of the first engagement. Tracked via a unique referral URL (`/ref/marc`). One D1 table for tracking.

**Why:** When you're at cap, "join the waitlist" is *waste*. This turns waste into either goodwill or revenue. Net positive either way.

— 4-6h (the page + a referrals D1 table for the fee path).

### 5.6 The book / course

**The angle:** "How I built and ship a $1500-engagement solo practice in 6h/week."

**Why this works:** You have the practice, you have the portal, you have the *actual numbers*. The audience for this — devs eyeing a side-gig — is exactly the audience that buys $49-$99 PDFs.

**Surface options:**
- **PDF on Gumroad** — easiest, lowest ceiling. $49-$99. — 2 weeks of evenings.
- **Email course** — 1 email per week for 8 weeks, $99 lifetime access. — 3 weeks of evenings.
- **A focused 1-day video course** — most premium, most work, highest price ($199-$299).

Don't start now. Park it as a Q4 2026 candidate. The portal itself has to be the proof.

### 5.7 Sentry-style "Sponsor a feature" on the public LAC meta page

Far-out idea, low priority, but mention:

Each `feat-*/` card on the `/meta` page (§4.1) could have a "this feature was funded by [name]" optional footer. A solo dev / a Quebec foundation / a small business could donate $100 → $1000 to "fund" Marc's next feature build, get a footer credit, get a write-up. Treats the portal like a research project. Niche but distinctive.

— Skip unless you get unsolicited "can I support what you're doing?" emails, which is the signal.

---

## 6 — Simple to operate

This is the part of the practice that protects your evenings.

### 6.1 Batch-reply admin screen

**Current ops:** Marc opens `/admin/inbox`, clicks each session, reads, types a reply in the session thread, hits send, changes status. Repeat. Per session = 3-5 minutes.

**Move:** A single screen, `/admin/triage`, that shows *all sessions with status = triage or draft* in a stacked-card view:
- Each card: visitor email, type, the intake summary (200 chars), capacity counter.
- Three preset reply buttons: **Yes** (auto-text "Pris en charge. Démo dans 5 jours."), **No** (auto-text "Merci. Pas un fit cette fois — voir Tier 0 →."), **More** (auto-text "Quelques questions avant d'accepter:").
- A single text-area for inline edit.
- A "send + change status" composite button.

**Result:** Sunday-evening triage of 4 sessions: 4 min instead of 20.

**Work:** 1-1.5 days.
- New page + API endpoint for batch list: half-day.
- The three preset templates as D1-stored editable strings: 30min.
- Composite action (send-email + update-status) wired: 2-3h.
- Mobile-first layout: 2h.

### 6.2 Advancement auto-draft on deploy

See §4.2 — this is also operational quality-of-life. When a deploy lands, Marc gets a one-click "publish this advancement" rather than building it from scratch.

### 6.3 Reply templates editable in admin

`functions/_lib/email.ts` likely has hardcoded reply text. Lift to a `email_templates` D1 table editable from an admin page. Means Marc can iterate copy without code commits.

— 3h.

### 6.4 "Mon dimanche" digest improvements

The existing daily digest fires at ~8am with sessions older than 48h.

**Improve:**
- **Sunday-evening flavor:** a separate, opinionated digest sent at 7pm Sunday: "Ta semaine — 2 sessions actives, 1 décision à prendre, 0 urgences." Different cadence, different tone. Drives weekly habit (Marc opens portal once on Sunday, blasts through triage, closes laptop).
- **Mobile-optimized:** the digest email's HTML should render well on a phone (the family-time read).
- **Pre-filled actions:** the digest links to `/admin/triage?since=2026-05-09` so Marc lands directly on what's new.

— 2-3h.

### 6.5 The "wrap up & ship" wizard

When a session is ready to move from `active` → `shipped`, Marc currently has to:
- Set the showcase fields (title, tagline, tier).
- Post a final advancement.
- Send an email to the visitor.
- (Optionally) sign the v1.0-handoff tag.
- Confirm the ownership mode (Tout à toi / Je m'en occupe).
- Maybe update the dormancy contact info.

**Move:** A `/admin/sessions/:id/ship` wizard — 4 steps, each pre-filled. End-to-end < 5 min.

— 6-8h. High value the first time you ship a real client.

### 6.6 Delete the dead "Stripe arrive bientôt" stub

If you don't ship §5.1 in the next 30 days, remove `AdminBilling.tsx`'s "coming soon" message. It's been there since Phase 1 and it's a false promise to any buyer who lands on it.

Also: if you go with §3.4 path (a) (delete buyer-admin), this is done automatically.

— 5 min.

### 6.7 Inbox sort by SLA-overdue first

`STATUS_ORDER` currently sorts triage → active → draft → shipped → rejected. Add a *secondary* sort: within each status, overdue-SLA first.

— 30 min. Surfaces "the one Marc forgot" at the top automatically.

### 6.8 One-tap mobile admin

Marc is doing triage on his phone at 9pm. The current admin UI is desktop-shaped. The §6.1 batch-reply screen needs to be mobile-first.

Specific verifications:
- Tap targets ≥ 44px.
- No horizontal scroll on 360-wide.
- The preset-reply buttons live as a fixed bottom bar.
- A swipe-right on a card = "accept", swipe-left = "reject" (with confirm).

— 3-4h.

---

## 7 — The 30-day backlog (prioritized, time-budgeted)

Roughly ordered by ROI. Each item self-contained — pick any.

### Week 1 (high-impact, low-friction)
- **S1.** Stripe account + Tax registration in QC (no code, just paperwork). 2h.
- **S2.** Signature OG card update (add stamp + napkin element). §2.1. 4h.
- **S3.** Hero CTA visual promotion + ToC demotion. §2.2 (a, b). 1h.
- **S4.** Inline SND audio preview on home. §3.3. 3h.
- **S5.** Public "next slot opens" pill on home (rough version, no calendar yet). §4.4. 1h.

### Week 2 (revenue infrastructure)
- **S6.** Stripe Checkout for Tier 1/2 deposits. §5.1. 1.5-2 days.
- **S7.** PIA addendum + privacy page update for Stripe processor. Reuse Loi 25 pattern. 2-3h.
- **S8.** Sentry-style RUNBOOK section for Stripe failures. 1h.
- **S9.** Pricing block as printed menu. §2.3. 2-3h.

### Week 3 (operability)
- **S10.** Batch-reply `/admin/triage` screen. §6.1. 1-1.5 days.
- **S11.** Inbox sort by SLA-overdue first. §6.7. 30min.
- **S12.** Auto-draft advancement on deploy (GitHub Action + endpoint). §4.2. 6-8h.
- **S13.** Mobile audit + tap-target fixes. §3.6 + §6.8. 4-6h.

### Week 4 (creative + completeness)
- **S14.** Public LAC meta page (`/meta`). §4.1. 4-6h.
- **S15.** Custodian-mode subscription via Stripe. §5.2. 1 day.
- **S16.** Decision on buyer-admin code (§3.4): delete OR add feature.json frozen note OR begin productize. Whichever path: half-day to a week.
- **S17.** Newsletter form + first edition cron. §4.5. 4-6h.

### Floating (do whenever)
- **F1.** Accessibility spot-fixes from §3.7. 1-2h.
- **F2.** 404 + RouteError visual treatment. §2.5. 1h.
- **F3.** Success-stamp animation. §2.4. 1h.
- **F4.** Capacity meter tick animation. §2.4. 30min.
- **F5.** Currency formatting OQLF audit (`≈ 300 $`). §4.6. 1h.
- **F6.** Construction-holiday banner. §4.6. 30min.

**Total budget:** ~3-4 weeks of evenings (10-15h/week) if executed back-to-back. Cherry-pick if not.

---

## 8 — The 90-day backlog

Quarterly bets. Higher uncertainty, higher ceiling.

- **Q1.** SND template productized on Gumroad ($99). §5.3. 3 days.
- **Q2.** Referral page + finder's-fee D1 tracking. §5.5. 4-6h.
- **Q3.** Voice intake (30-sec audio recording). §4.3. 3-4h.
- **Q4.** Public capacity calendar with computed next-slot date. §4.4. 6h.
- **Q5.** Year-in-review page generator (queued for Dec 30 each year). §4.8. 4h.
- **Q6.** AI-assisted private inbox hints (Claude Haiku). §4.9. 4h.
- **Q7.** Post-shipment journey: "felicitations" moment + refer-a-friend mechanic. §3.1. 6-8h.
- **Q8.** White-label portal template ($999 setup or $499 self-install). §5.4. 1 week.
- **Q9.** "5-minute tour" page for "I just want to peek" visitors. §3.2. 4h.

---

## 9 — Things to NOT do

A list of seductive but wrong moves. Each blocks itself if explicitly written down.

- **Don't redesign the palette.** Cream + sage is *the* brand. Switching to navy + coral or anything trendy resets your 8 months of design equity. The only OG-card palette to retire was the warm-amber one, and that's done.
- **Don't introduce a SPA framework swap.** React 19 / Vite / React Router 7 is current and boring. Next/Remix/Astro would *cost* you the Cloudflare Pages Functions integration that's load-bearing.
- **Don't add a CSS-in-JS library.** `styles.css` is 8k lines but it's *one file*, regex-able, AI-friendly, fast to ship. Tailwind / styled-components would un-do the editorial coherence.
- **Don't build a "real" CMS.** The current "Marc edits feature.json + showcase fields" flow is the right amount of friction. A WordPress-like editor is a quagmire.
- **Don't go multi-tenant SaaS.** Bmad's 2026-05-09 decision stands. Productize one-time copies (§5.4), not subscriptions to a multi-tenant platform.
- **Don't make the portal English-first.** FR-CA is the home language. The EN routes are the courtesy mirror, not the primary.
- **Don't add a chat widget.** "No calls, no meetings" extends to "no live chat." If a visitor needs to ask something, they submit. The async constraint is the product.
- **Don't accept feature requests that break the 1-active rule.** The bedrock constraint. If you find yourself raising the cap, re-read Insight #39 (per README.md).
- **Don't add Google Analytics / Plausible / anything client-side observational.** Sentry covers errors; the digest cron covers ops. Beyond that, vanity metrics are weight. (If you ever need conversion data, server-side log on accepts + ship is enough.)
- **Don't write a tagline change.** "Marc-Antoine, là pour résoudre des problèmes importants pour ma communauté" is doing real work. Don't fix what isn't broken.
- **Don't fix what AUDIT.md already deferred with rationale.** Each ⏭ item has a "re-open when X" trigger. Wait for X.
- **Don't add an admin keyboard-shortcut overlay until §6.1 ships.** Premature optimization of an interface that should first exist.
- **Don't open the gates to non-Quebec clients.** The Quebec angle is part of the moat. If RoW interest spikes, route to a partner referral (§5.5).

---

## 10 — Open questions only Marc can answer

These I couldn't decide unilaterally. Each blocks a downstream item.

- **Q1. The fate of buyer-admin / Fleet code.** Delete, freeze-with-note, or productize? See §3.4. Blocks §5.4. Default if no answer: freeze-with-note (cheapest).
- **Q2. Stripe vs Square vs e-Transfer only.** Stripe is recommended (§5.1) for QC tax handling. Square is fine but worse for online checkout. e-Transfer-only is the no-change option. Default if no answer: Stripe.
- **Q3. Does the SND template have an audience?** Validated only by listing it (§5.3) and watching for sales. Risk: $0. Cost: 3 days. Default if no answer: ship and see.
- **Q4. Newsletter list — opt-in only or also auto-subscribe shipped clients?** Recommendation: opt-in only. Auto-subscribing breaks the "respect your inbox" promise.
- **Q5. The book.** Park to Q4 2026 (§5.6)? Yes — default if no answer.
- **Q6. Referral arrangement — goodwill or finder's-fee?** No-brainer if you have specific names already in mind. Otherwise default: goodwill (simpler, no D1 schema).
- **Q7. The voice-intake feature — does it add anxiety for some visitors?** Probably for some. Make it strictly optional, never on by default. Default: ship as optional addition, monitor uptake.
- **Q8. The "publish portal's own feature.json" page (§4.1) — public or auth-gated?** Public. The whole point is the meta moat. Default: public.
- **Q9. Tier 0.5 (the $99 SND template) — does it dilute the "I read every form myself" brand?** Marginally yes. It's a *template*, not an *engagement* — the messaging needs to make that clear. Default: ship with explicit framing ("auto-service, comme Tier 0, mais pré-fait").

---

## 11 — How to read this document tomorrow

If you woke up tired and want to *do* something: open §7 Week 1 and pick **S2** or **S3** — both are 1-4h, both visible, both done by noon.

If you woke up sharp and want to *think* something: open §3.4 (buyer-admin fate), §5.1 (Stripe), §5.4 (white-label). Decide one. Write the decision into `AUDIT.md`'s working notes.

If you woke up curious and want to *explore* something: open §4 — pick the wildest item. The portal's own LAC meta page (§4.1) is the highest-leverage of the creative bets.

If none of the above: just read §0 and §1 again. Sometimes the audit is the artifact, and the next action is patience.

---

## Appendix A — What this audit covered

- `package.json`, `README.md`, `RUNBOOK.md`, `AUDIT.md`, `bmad/AUDIT_2026-05-09.md`
- `src/i18n.ts`, `src/styles.css` (sampled), `src/main.tsx`, `index.html`
- `src/pages/{Home, MePortal, Handoff, Tier0, AdminHub, AdminInbox, AdminFleet, AdminBilling}.tsx`
- `src/components/{Hero, Pricing}.tsx`
- `public/{og-image.svg, og-image-en.png, audio/*, fonts/*}`
- `functions/api/*` (directory listing)
- `docs/{loi-25-pia.md, handoff/CHECKLIST.md}`
- `feat-*/` directory listing
- Recent git history (`bde1e29`, `8fb5444`, `83ab9c8`, `75af44e`, `4b25d7a`)
- Memory entries: Loi 25 third-party processor pattern, CF Pages wrangler-toml-managed vars, npm lockfile

## Appendix B — Where the audit did *not* go deep

For honesty: I did not exhaustively read:

- Every `feat-*/feature.json` (sampled the directory listing).
- The full 8k-line `styles.css` (sampled hero, palette, motion).
- `functions/_lib/*` server-side helpers in detail.
- The Volunteer / SndApp buyer-template UIs.
- The Excalidraw integration code path.
- Database migration files individually.

Findings here are correct at the layer they describe (architecture, copy, brand, product strategy). For specific implementation details — *especially before doing a destructive change like §3.4 path (a)* — verify the code path locally first.

## Appendix C — Calibration

This plan is *aspirational by design*. The 30-day list is more work than you can do in 30 days. Pick. Cut. Defer. Each item that ships matters more than the plan looking complete.

The bedrock test for any item below: **"if I ship this, does it protect or grow my family time?"** If no, drop it.

— end —
