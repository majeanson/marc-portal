import { useEffect } from 'react'
import type { Lang } from '../i18n'
import { DICT } from '../i18n'
import { useTabTitleWink } from '../lib/tabTitleWink'
import { useHashScroll } from '../lib/hashScroll'
import { Header } from '../components/Header'
import { Hero } from '../components/Hero'
import { HowItWorks } from '../components/HowItWorks'
import { FeaturedProjects } from '../components/FeaturedProjects'
import { VibeFilter } from '../components/VibeFilter'
import { Pricing } from '../components/Pricing'
import { CTA } from '../components/CTA'
import { About } from '../components/About'
import { Footer } from '../components/Footer'
import { SectionRail } from '../components/SectionRail'
import { ScrollProgress } from '../components/ScrollProgress'
import { PullQuote } from '../components/PullQuote'
import { MobileStickyCta } from '../components/MobileStickyCta'
import { FAQ } from '../components/FAQ'
import { Testimonials } from '../components/Testimonials'
import { NapperonDoodles } from '../components/NapperonDoodles'
import { BringAnything } from '../components/BringAnything'
import { EnglishNudge } from '../components/EnglishNudge'

export function Home({ lang }: { lang: Lang }) {
  const t = DICT[lang]

  // Swap the tab title to a "come back" wave when the visitor switches away.
  useTabTitleWink(t.tabAway)

  useEffect(() => {
    document.documentElement.lang = t.langCode
    document.title = t.brandTitle
    const meta = document.querySelector('meta[name="description"]')
    if (meta) meta.setAttribute('content', t.metaDescription)

    // Per-language OG image. Static index.html ships the FR variant for
    // crawlers that don't run JS; for clients that re-resolve OG on copy-
    // link (some chat apps do, Slack notably does not), the swap below
    // ensures the EN page also offers the EN card. Same for twitter:image.
    const ogImage = lang === 'en' ? '/og-image-en.png' : '/og-image.png'
    const ogImageEl = document.querySelector('meta[property="og:image"]')
    if (ogImageEl) ogImageEl.setAttribute('content', ogImage)
    const twImageEl = document.querySelector('meta[name="twitter:image"]')
    if (twImageEl) twImageEl.setAttribute('content', ogImage)
    // og:locale follows the language too.
    const ogLocale = document.querySelector('meta[property="og:locale"]')
    if (ogLocale) ogLocale.setAttribute('content', lang === 'en' ? 'en_CA' : 'fr_CA')
  }, [lang, t])

  // Scroll-to-hash on cold load — see lib/hashScroll.ts for the full story.
  // Header section links point at /#featured, /#how, /#pricing, /#vibe,
  // /#about. The hook handles the layout-shift problem that was leaving
  // visitors above their target when FeaturedProjects' API call landed.
  useHashScroll()

  return (
    <div className="app">
      <ScrollProgress lang={lang} />
      {/* EnglishNudge sits ABOVE Header so an EN-browser visitor sees the
          choice land first and the page settles. Stacked between Header
          and content it reads as a banner ad. */}
      <EnglishNudge lang={lang} />
      <Header lang={lang} />
      <SectionRail lang={lang} />
      <main id="main-content" className="home">
        {/* 0 — Napperon doodles: hand-drawn margin glyphs (coffee ring, red-pen
              circle, ink check, etc.) pinned in the gutters. Pure decoration,
              aria-hidden, hidden under 1080px. Reinforces the placemat
              metaphor across the whole page, not just the canvas widget. */}
        <NapperonDoodles />
        {/* 1 — Hero: the offer + primary CTA, above the fold */}
        <Hero lang={lang} />
        {/* 2 — Featured projects: real /projects feed, top 3, foregrounded as
              proof-of-work for cold visitors. Hides itself if the gallery is
              empty so the home page never looks half-built. Full gallery lives
              at /projects (see-all link in-section). */}
        <FeaturedProjects lang={lang} />
        {/* 3 — How: 4-step expectation-setter, very fast read */}
        <HowItWorks lang={lang} />
        {/* 4 — About: short bio. Moved up from its old end-of-page slot per
              R3 design pass — visitors meet Marc before they commit to the
              full scroll, so the personal layer lands before the funnel
              starts pushing toward a click. */}
        <About lang={lang} />
        {/* 5 — Vibe filter: do/don't lists — self-qualification gate. Comes
              BEFORE pricing: the visitor decides "is this for me?" first, so
              the numbers land on someone already half-qualified rather than
              gating the read with a price. */}
        <VibeFilter lang={lang} />
        {/* 6 — "Bring me anything": neutralizes the self-filter the vibe
              ledger can trigger. Marc's framing: I want every idea in my
              inbox; the triage is my job, not the visitor's. Examples are
              aspirational ("things I'd take"), not fake-historic. */}
        <BringAnything lang={lang} />
        {/* 6b — Pull-quote: cushions the transition from "anything is
              welcome" to "here's what it costs". Marc's voice grounding
              the move from generous to commercial right before the
              numbers land. */}
        <PullQuote lang={lang} />
        {/* 7 — Pricing: concrete numbers, read after the visitor has
              self-qualified through the vibe gate and been grounded by
              the pull-quote. */}
        <Pricing lang={lang} />
        {/* 8 — Testimonials: social proof just before objections (FAQ).
              Component self-hides when zero approved vouches exist, so the
              section only appears once /vouches has something to show.
              SectionRail filters its index by element presence, so the
              rail entry hides in lockstep. */}
        <Testimonials lang={lang} />
        {/* 9 — FAQ: handles common objections before the final CTA. JSON-LD
              FAQPage schema is injected for SEO rich results. */}
        <FAQ lang={lang} />
        {/* 10 — Final CTA: one last push before the footer. Inline intake
              teaser used to live above this as its own section; per R3 the
              two CTA panels were competing, so the type-picker grid was
              folded INTO the final CTA panel and the standalone teaser
              section was retired. ShareSite likewise collapsed to a footer
              line. */}
        <CTA lang={lang} />
      </main>
      <Footer lang={lang} />
      <MobileStickyCta lang={lang} />
    </div>
  )
}
