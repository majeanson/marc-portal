import { useEffect } from 'react'
import type { Lang } from '../i18n'
import { DICT } from '../i18n'
import { Header } from '../components/Header'
import { Hero } from '../components/Hero'
import { HowItWorks } from '../components/HowItWorks'
import { DemoEmbed } from '../components/DemoEmbed'
import { ShowcasesWall } from '../components/ShowcasesWall'
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
        <Hero lang={lang} />
        <HowItWorks lang={lang} />
        <DemoEmbed lang={lang} />
        <ShowcasesWall lang={lang} />
        <VibeFilter lang={lang} />
        <Pricing lang={lang} />
        <CTA lang={lang} />
        <About lang={lang} />
      </main>
      <Footer lang={lang} />
    </div>
  )
}
