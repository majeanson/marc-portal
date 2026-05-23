# Marc Portal — Wild Ideas Box

**Date:** 2026-05-23
**Stance:** unfiltered, weird-on-purpose, anti-roadmap. Most should not ship. The point is the corpus.

These are ideas that fail the "would I tell a stranger about this with a straight face" test on purpose. Save the sober list for `AUDIT_*.md`. Save this list for the 11pm "I want to want to work on the portal again" energy.

Numbered for citation; ordered loosely by category, not priority. Most should be killed on second read. A few should ship next weekend.

---

## I. The portal is a person, not a product

1. **`/today`** — a single page showing what Marc is doing right now. Last commit, current branch, build status, Quebec weather, "deep work" vs "shipping" mode. Refreshes itself every 60s, no spinner. Reads like a smoke signal more than a status bar.

2. **`/api/marc.json`** — same data, JSON. Hobbyists scrape it; one of them builds a Raspberry-Pi desk lamp that turns warm when Marc is online and dim when he's not. He doesn't know; you do.

3. **The boat mood indicator** — extend the journey-page boat (see `feat-journey-boat-drift`) to *every page*. Posture reflects `/api/capacity`: full sail (idle), reefed (1 active), docked (1+1, at cap). Footer detail, never primary.

4. **"Marc's gone home" mode** — 6pm America/Toronto, the intake form's submit copy flips: *"Je vois ça demain matin, promis."* Webhooks still process; payments still complete; auth still works. The marketing copy alone declares the off-hours boundary. SLA *in the UI*, not in a contract.

5. **Coffee-level meter** — pulled from local commits per hour over a 4h rolling window. High commit rate → "espresso." Low → "tisane." Renders as a single mono character in the footer. Pure smoke.

6. **`/marc-not-working-on`** — public, anonymized list of projects Marc *declined* in the last 90 days, with the reason. "Out of scope," "I'd be the bottleneck," "I don't know the domain well enough to charge for it." Anti-portfolio.

7. **The regret board** — `/regrets`. Past architectural / copy decisions Marc would reverse if free. Dated entry, "I thought…", "Turns out…", and a link to the commit that ended the regret (or didn't). The point is calibration honesty.

---

## II. Pricing as performance art

8. **Time-as-currency** — beside every CAD price, a "≈ N weekends" or "≈ N evenings" estimate. Anchors the cost in lived experience. Costs nothing because everyone already converts mentally.

9. **The trade tier** — Tier T, alongside 0–4. Visitor offers something non-monetary Marc explicitly accepts: a meal cooked at his house, a book recommendation that delivers, a one-hour lesson in a domain Marc wants to learn (banjo, sailing, French slang). Browsable index of past trades with photos.

10. **Pay-it-forward** — quarterly, one Tier-1 slot at 50% off. Condition: the buyer commits to 1h of free advisory work for another solo dev in Quebec. Receipt is public. Marc is the bank.

11. **The pricing roulette** — homepage easter-egg. "Click here for a chance at your tier." Spins, lands deterministically on the tier a 90-second quiz would have given them. Joke wrapper, real recommendation.

12. **Decay pricing** — the home page shows the Tier-1 number declining by $1 every 15 minutes throughout the day; at midnight Quebec it resets to morning's price. Pure psychological theatre. (Real price is fixed; the "discount" is reset every dawn.) Reframes the page as a slow-motion clock, not a brochure.

13. **Reverse intake** — drop the "what do you want?" form for one that asks "what do you absolutely NOT want, in your final product?" Tier suggestion derived from negations. Visitors who can articulate the don'ts are usually clearer than the ones who can articulate the dos.

14. **The lazy intake** — a tier-zero variant: no form. Just a 60-second voice memo. Marc replies in 24h with a paragraph estimate. Useful for visitors who've been priced into paralysis everywhere else.

15. **Patience credits** — visitors accumulate credits by *waiting* on the site (one credit per 30s on a page with no clicks). 20 credits = a small acknowledged discount. Marc sells slowness back to people.

---

## III. Visual & interaction whims

16. **Cursor-as-pen** — visitor's cursor leaves a faint ink trail across the page, fading in 5s. The whole site already reads "hand-drawn"; cursor should too.

17. **Hover gravity** — interactive elements pull the cursor 3–5px toward their center on approach. Like steel-tipped pen drifting toward the nib well. Almost imperceptible; deeply felt.

18. **Napperon multiplayer** — `/napkin` sketches are *shared*. Concurrent visitors see each other's strokes for 30s, then fade. Hide identifying info: no names, no cursor, just ink. A real placemat at a real café would be touched by strangers; so should this one.

19. **Mood-fingerprint gradient** — when a visitor leaves, compute a gradient from their click path (sections visited, time per section, hover patterns). Show on the last page as "ton passage." Optional download. A keepsake of someone's read.

20. **The OG card ages** — `/og/share/:id` redraws every time it's fetched. Months later, the linked card includes "current build: v7." Old shares stay valid; the preview reflects today.

21. **The handoff is a movie poster** — when a project hits `frozen`, generate a downloadable movie poster: title, runtime ("≈4 weekends"), critic blurb (the vouch quote), starring credits (visitor name, Marc), poster art (project's OG image, treated). Frame it.

22. **Page-weight as art** — footer shows the JS bundle as a hand-drawn weight in mono: "23 KB · postcard." Small flex; mostly humility.

---

## IV. The site documents itself

23. **`/portal-portal`** — meta page about the portal. Every shipping decision, every `feature.json`, every commit, every visual baseline. The site as exhibit of itself. Already half-true via `/meta` + `/atelier` — combine and amplify.

24. **`/atelier-live`** — visitors can suggest CSS tweaks. Vetted weekly. Accepted suggestions ship in the next deploy with a `Co-Authored-By` in the commit. Community-curated aesthetic without crowdsourcing the soul.

25. **Code thrift store** — `/atelier/retired` shows components Marc *removed* from main. Snippets are downloadable, with a note explaining the breakup. The deleted code as a story, not as loss.

26. **Author's notes** — first comment of every component file becomes a first-person autobiographical paragraph: what Marc was avoiding when he wrote it, the constraint, the doubt, the mood. Searchable. The codebase as journal.

27. **Failure of the week** — public page. The worst bug from the last 7 days, screenshot, root cause, fix commit hash, Marc's self-grade. The opposite of a "what's new" newsletter. Visitors come to *learn from the mistakes*.

28. **`/wat`** — collect the most confusing question visitors had on their first visit (anonymized, opted-in). Update monthly. Marc adds his own "wat?" entries about *his own code*. The site as a confusion archive.

---

## V. Anti-AI-tell crusade extensions

29. **`npm run check-tells`** — a lint pass that fails CI on AI-tell patterns: em-dash density per paragraph, negation anaphora ("Not X. Not Y. A Z."), rule-of-three nouns, marketing superlatives without backing claims. Configurable thresholds. The portal's voice is enforced by a script.

30. **`npm run unsterile`** — generative inverse: takes a chunk of new copy, scores its tell-density, and refuses to commit until it sounds human. Optionally suggests Québécoisifications.

31. **Tell debt dashboard** — `/admin/tells` shows which strings in `i18n.ts` have the highest tell scores. Marc fixes them in spare moments like a code-cleanup queue.

---

## VI. Codebase oddities

32. **`/sysend`** — admin-only endpoint Marc hits at end of day. Locks the deploy pipeline overnight, posts a summary email to himself, freezes `wrangler pages dev`. Rituals matter; this is the digital "shop is closed" sign.

33. **PR description poems** — optional `## Poem` section in every Marc-authored commit body. Collected over time into a corpus. Already aligned with the editorial voice; only the convention needs to exist.

34. **Code review as performance** — `gh pr comment` replaced with a 5-min screencast of Marc reviewing his own PR aloud. Embedded as the PR description. The visitor (or future-Marc) sees the *thinking*, not the diff.

35. **Reverse video tour** — Marc records 60-90s of himself reading the visitor's *intake submission* out loud, eyes-on-screen, with his thinking-face. Sent as the first response. The visitor hears their own words slow down. Costs nothing; communicates everything.

36. **Pheromone trail in `/atelier`** — components frequently used together pulse when one is hovered. Lets a visitor see the *social* structure of the codebase, not just the file tree.

---

## VII. Privacy as theatre

37. **Loi-25 receipt** — every visitor gets a downloadable PDF receipt at session end: what was collected, how long stored, who has access. Formatted like a Café Brûlé restaurant bill (Marc's font + tone). Tiny act of dignity.

38. **`/me/data-shame`** — authenticated visitors see what Marc has on them, plotted on a "minimal ↔ uncomfortable" axis. Always lands at "minimal." A passive lecture about what *other* sites collect.

39. **Erasure as ritual** — when a visitor hits delete-my-data, the UI plays a 3s animation of their data tokens *fading to paper*. Quiet drama. Confirms it's actually gone, not just promised gone.

40. **Pre-collection consent slider** — instead of a banner, a tiny slider in the footer with three notches: "minimum," "default," "Marc may peek to debug." Default is minimum. Slider state is the consent record.

---

## VIII. Quebec-flavored

41. **Pricing in maple syrup** — beside every CAD figure, current market price of an equivalent volume of maple syrup. Sole-Quebecois flex. (Real-time scraped from Producteurs et productrices acéricoles du Québec.)

42. **The Tim Hortons counter** — footer counter: "coffees consumed building this site." 1 coffee = 1 commit, since the dawn of the repo. ≈3,500 today. Truthful and absurd.

43. **Dialect-aware copy** — `Accept-Language: fr-CA` and `fr-FR` get *different* translations in critical places. `fr-CA` says "céduler" and "courriel"; `fr-FR` says "programmer" and "mail." Tiny act of localization solidarity. The bilingual contract isn't FR/EN; it's `fr-CA/fr-FR/en-CA`.

44. **The Caisse populaire admin** — `/admin/*` rendered in the visual style of a 90s Quebec credit-union statement: cream paper, mono Courier, dot-matrix margins, "RELEVÉ MENSUEL" header. Internal-only flex.

45. **Speak FR or wait** — visitors arriving with `en-*` Accept-Language get a 5-second "want to learn a Quebec word?" intro screen before the home page renders. (Marc's pet quirk. The word changes weekly. "Tannant," "fait que," "asteure.")

---

## IX. Operational avant-garde

46. **Visitor ghost cursor** — on `/carte`, a faint trail shows where Marc himself has been routing through the site. Like a heat map of his own thinking. Updated daily.

47. **Replay mode** — `/admin/replay` lets Marc scrub through a day's anonymized cursor traces. Like watching ants. Helps him spot dead ends in the funnel.

48. **Forced reflection prompts** — every merge triggers a CI step that asks Marc a Quebec reflection question, posted as a PR comment: "Pourrais-tu expliquer ça à ta mère ?" / "Worth the weekend?" If unanswered in 24h, the next PR gets a polite nag.

49. **The 24h cooldown** — intake submission enforces a 24h pause before the first response, even if Marc is ready. Sells slowness as a feature. (Toggleable for explicit emergencies.)

50. **Mandatory `/wholesome` counter** — counts the times a visitor's intake led Marc to reply *"you don't need me, here's how to do it yourself."* Public metric. The portal's anti-business indicator.

---

## X. Pure whimsy / probably-bad-ideas

51. **Anti-newsletter** — subscribe to *not get emails*. Marc contractually commits to one-way silence. Yearly notice that he's still silent.

52. **The anti-CTA** — a button somewhere on the home that says "Don't click me." Clicking it shows Marc's calendar of times he is *not* taking work. Relief valve.

53. **Hidden Tier -1** — visitors who scroll to the bottom of the home three times in one session unlock a secret tier where Marc pays *them* to do something he doesn't want to do. Real listing, real money, max 2/year.

54. **The OG card is a portrait** — instead of a static brand card, `/og/share/:id` renders a low-fi line-drawing of the first visitor's silhouette from anonymized cursor-trace shape. A site that looks at *you* a little, too.

55. **Pricing in poems** — each tier's description, when read aloud, scans as iambic something. Hidden meter. Marc-only joke.

56. **Random Quebec hockey jersey number** — every signed-in visitor gets one. Persistent. Lampshaded once on the `/me` page and never again. The portal's "you exist" gesture.

57. **The site renders as a Word document on April 1** — Comic Sans, blue underlined links, red squiggle under Québécois words. Lasts 24h. Marc's annual gift to himself.

58. **`/wat-test`** — single-question quiz: "what does this code do?" with four wrong answers. Educational about why "wat?" is a valid technical reaction. New question monthly.

59. **The boat actually sails on Marc's keystrokes** — the journey boat advances pixel-by-pixel based on Marc's commit rate. Slow weeks = boat barely moves. Brutal honesty as ambient art.

60. **Code letterpress** — every printable artefact (proposal, handoff, invoice) renders as if printed by a 19th-century press: ink-spread on edges, watermark texture, slight letter wobble. Sells craftsmanship without claiming it.

---

## Stop-doing list (ideas to actively NOT pursue)

- ❌ Live chat. The whole portal is async-first; live chat reverses the contract.
- ❌ AI-written email replies. The Quebecois voice is the moat. A model trained on it dilutes it.
- ❌ Push notifications, anywhere, ever. Loi 25 spirit + Marc-as-human contract.
- ❌ Gamification points (badges, streaks, achievements). The "patience credits" idea above is acceptable because it's a joke; a real loyalty program is not.
- ❌ A "blog" or "newsletter" in the conventional sense. `/atelier`, `/meta`, the public commit log, and a published `feature.json` already do this *with* the work, not *about* it.
- ❌ Open-source the codebase as a portfolio piece. It's the practice's *substrate*, not a library. Pull request etiquette would dilute Marc's time. Code thrift store (#25) gives 80% of the benefit at 0% of the cost.

---

## How to use this file

Re-read once per quarter. Pick the one item that makes you laugh and the one item that makes you slightly uncomfortable. Ship those two. Ignore the other 58.

Do not let this file rot into a roadmap. Wild ideas deserve a wild file.
