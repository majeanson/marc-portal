import { useEffect } from 'react'
import type { Lang } from '../i18n'
import { DICT } from '../i18n'
import { useTabTitleWink } from '../lib/tabTitleWink'
import { Header } from '../components/Header'
import { Hero } from '../components/Hero'
import { HowItWorks } from '../components/HowItWorks'
import { FeaturedProjects } from '../components/FeaturedProjects'
import { VibeFilter } from '../components/VibeFilter'
import { Pricing } from '../components/Pricing'
import { CTA } from '../components/CTA'
import { ShareSite } from '../components/ShareSite'
import { About } from '../components/About'
import { Footer } from '../components/Footer'
import { SectionRail } from '../components/SectionRail'
import { ScrollProgress } from '../components/ScrollProgress'
import { PullQuote } from '../components/PullQuote'
import { MobileStickyCta } from '../components/MobileStickyCta'
import { InlineIntakeTeaser } from '../components/InlineIntakeTeaser'
import { FAQ } from '../components/FAQ'
import { Testimonials } from '../components/Testimonials'
import { NapperonDoodles } from '../components/NapperonDoodles'
import { BringAnything } from '../components/BringAnything'

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

  // Scroll-to-hash on cold load. The Header section links point at /#featured,
  // /#how, /#pricing, /#vibe, /#about; when clicked from a non-home route the
  // browser navigates here but its native hash-scroll fires before async-
  // mounted sections (FeaturedProjects fetches public projects) are in the
  // DOM, so the visitor lands on the home top instead of the target section.
  //
  // Strategy: poll every 80ms for up to 1.5s. As soon as the target element
  // exists in the DOM, scroll to it and stop. Earlier passes (immediate +
  // rAF) catch sections that mount synchronously; later passes catch slow
  // network fetches. A single retry at 250ms was leaving first clicks
  // failing on slow phones (visitor's complaint: "I have to click twice").
  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, '')
    if (!hash) return
    let stopped = false
    let attempts = 0
    const MAX_ATTEMPTS = 18 // 18 * 80ms ≈ 1.4s, longer than any realistic SPA mount
    let timer: number | undefined
    const tick = () => {
      if (stopped) return
      const el = document.getElementById(hash)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' })
        return
      }
      if (++attempts < MAX_ATTEMPTS) {
        timer = window.setTimeout(tick, 80)
      }
    }
    // First pass: synchronous, in case the target is already in the DOM.
    tick()
    return () => {
      stopped = true
      if (timer !== undefined) window.clearTimeout(timer)
    }
  }, [])

  return (
    <div className="app">
      <ScrollProgress lang={lang} />
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
        {/* 4 — Pricing: concrete numbers so visitors self-qualify */}
        <Pricing lang={lang} />
        {/* 4b — Inline intake teaser: low-friction "pick a type" CTA right
              after pricing. Skips the type-picker step inside /intake. */}
        <InlineIntakeTeaser lang={lang} />
        {/* 5 — Vibe filter: do/don't lists — final self-qualification gate */}
        <VibeFilter lang={lang} />
        {/* 5b — "Bring me anything": neutralizes the self-filter the vibe
              ledger can trigger. Marc's framing: I want every idea in my
              inbox; the triage is my job, not the visitor's. Examples are
              aspirational ("things I'd take"), not fake-historic. */}
        <BringAnything lang={lang} />
        {/* 5c — Pull-quote: a short voice break before About lands */}
        <PullQuote lang={lang} />
        {/* 6 — About: short bio near the end (visitors who care, scroll) */}
        <About lang={lang} />
        {/* 6½ — Testimonials: social proof just before objections (FAQ).
              Component self-hides when zero approved vouches exist, so the
              section only appears once /vouches has something to show.
              SectionRail filters its index by element presence, so the
              rail entry hides in lockstep. */}
        <Testimonials lang={lang} />
        {/* 6b — FAQ: handles common objections before the final CTA. JSON-LD
              FAQPage schema is injected for SEO rich results. */}
        <FAQ lang={lang} />
        {/* 7 — Final CTA: one last push before the footer */}
        <CTA lang={lang} />
        {/* 8 — Share-this-site affordance. Web Share API (mobile native
              sheet, desktop Chrome/Edge) with clipboard fallback.
              Surfaces the live /og/home card as the preview. */}
        <ShareSite lang={lang} />
      </main>
      <Footer lang={lang} />
      <MobileStickyCta lang={lang} />
    </div>
  )
}
