# Voice Rules — Excerpt for Design Reviewers

> Extracted from `portal/CLAUDE.md` for reviewers who only need the
> voice constraints, not the full Claude Code guide.

This site sells a *human* solo Québécois dev. Copy or visuals that
pattern-match ChatGPT undercut the pitch directly. Two layers to
internalize: the FR register, and the anti-AI tells (which apply to
both languages).

---

## FR is Québécois, not France

The bilingual contract isn't FR/EN — it's `fr-CA` / `en-CA`. Pick local
register over generic French.

- **Lean in:** "fait que", "tannant", "céduler", "ben", "pis",
  "tu veux-tu", "à soir", "asteure" when the tone allows. The verb
  "céduler" exists in Quebec French; use it rather than "programmer
  un rendez-vous". A solo dev's portal reads like a person, not a
  product team's localization PO.
- **Drop:** "alors donc", "c'est dingue", "kiffer", "truc/machin" as
  filler, "courriel/mail" inconsistency (use **courriel** — Quebec
  standard), formal "vous" for visitor-facing copy unless the surface
  is literally a legal document. First-person singular voice ("je",
  "moi", "j'ai") is the default — Marc speaks for himself.
- **Punctuation spacing:** Quebec/France French inserts a
  non-breaking space before `:`, `;`, `!`, `?`, `»` and after `«`.
  The Vite build strips literal U+00A0 / U+202F from string literals.
  Use the `frPunct()` helper (a nowrap `<span>`) instead of typing
  the NBSP directly.
- **Parity is a contract, not a suggestion.** Every key in FR exists
  in EN. If the FR phrasing is idiomatic enough that the EN
  translation feels stilted, rewrite the EN to a different idiom
  rather than chasing word-for-word.
- **Don't translate; rewrite.** "J'aime ça simple." → "I like it
  small." not "I like it simple." The vibe survives; the noun
  changes.

---

## Don't sound AI-generated (FR or EN)

This rule applies to copy, microcopy, comments, commit messages, *and*
visual treatments.

### Copy tells — banned by default

- **Em-dash density.** One " — " in a paragraph is fine. Setting off
  a clause this way in every UI string is the tell. Prefer periods,
  colons, subordination, parentheses, conjunctions.
- **Negation-anaphora.** "Pas un X. Pas un Y. Un Z." /
  "Not X. Not Y. A Z." reads as a chatbot crescendo. Dissolve into
  one real sentence with texture.
- **Rule-of-three triads of parallel nouns** ("clarity, honesty,
  follow-through"). Three is fine; flat parallelism is the tell.
  Give each item its own verb, length, or angle so it reads uneven.
- **Hedging filler.** "I'd love to help you with…", "Let's dive
  into…", "It's worth noting that…", "This is a great question."
  Cut. The voice is direct.
- **Marketing superlatives** absent evidence. "World-class",
  "best-in-class", "industry-leading". A solo dev doesn't claim
  these and the visitor doesn't believe them.

### Visual tells — banned by default

- **Gradient-clipped text** (`-webkit-text-fill-color: transparent`).
- **Uniform staggered slide-up reveals.** Reveals here are
  opacity-only ("ink-in"), not "fade-up".
- **Rounded status-badge pills with a coloured dot.** Status is a
  mono ledger tag with a filled/hollow square.
- **Decorative horizontal strokes appended via `::after`.**
- **Big floating CTAs with shadow lifts.** CTAs sit on the page.

When in doubt, the Québécois register is itself the strongest
anti-generic move. A line nobody outside Quebec would phrase that
way is by definition not chatbot output.
