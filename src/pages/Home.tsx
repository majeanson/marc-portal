import { useEffect } from 'react'
import type { Lang } from '../i18n'
import { DICT } from '../i18n'
import { Header } from '../components/Header'
import { Hero } from '../components/Hero'
import { HowItWorks } from '../components/HowItWorks'
import { FeaturedProjects } from '../components/FeaturedProjects'
import { VibeFilter } from '../components/VibeFilter'
import { Pricing } from '../components/Pricing'
import { CTA } from '../components/CTA'
import { About } from '../components/About'
import { Footer } from '../components/Footer'

export function Home({ lang }: { lang: Lang }) {
  const t = DICT[lang]

  useEffect(() => {
    document.documentElement.lang = t.langCode
    document.title = t.brandTitle
    const meta = document.querySelector('meta[name="description"]')
    if (meta) meta.setAttribute('content', t.metaDescription)

    // hreflang links — kept out of index.html because Vite tries to inline href="/"
    // as an asset; injecting at runtime is safe and updates per-language.
    const head = document.head
    const ids = ['hreflang-fr', 'hreflang-en', 'hreflang-default']
    ids.forEach((id) => document.getElementById(id)?.remove())
    const links: Array<[string, string, string]> = [
      ['hreflang-fr', 'fr-CA', '/'],
      ['hreflang-en', 'en-CA', '/en'],
      ['hreflang-default', 'x-default', '/'],
    ]
    for (const [id, hreflang, href] of links) {
      const link = document.createElement('link')
      link.id = id
      link.rel = 'alternate'
      link.hreflang = hreflang
      link.href = href
      head.appendChild(link)
    }
  }, [t])

  return (
    <div className="app">
      <Header lang={lang} />
      <main id="main-content">
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
        {/* 5 — Vibe filter: do/don't lists — final self-qualification gate */}
        <VibeFilter lang={lang} />
        {/* 6 — About: short bio near the end (visitors who care, scroll) */}
        <About lang={lang} />
        {/* 7 — Final CTA: one last push before the footer */}
        <CTA lang={lang} />
      </main>
      <Footer lang={lang} />
    </div>
  )
}
