/**
 * /template (and /en/template) — public-facing buyer guide.
 *
 * Renders Track C (template buyer journey) with a sales-shaped intro card
 * above the timeline. Same Track C data as the admin runbook's tab 2 —
 * single source. The admin tab links here so the operator can see the
 * buyer-facing rendering at a glance.
 *
 * Tone is buyer-facing but honest: no marketing fluff, no checkmark spam.
 * The sales card surfaces what you get and what you have to do — the
 * timeline below is the proof.
 *
 * Some strategic copy on the sales card (price, license model, support)
 * is intentionally left as a placeholder ("À décider") until the operator
 * answers the corresponding entry in the Decisions tab. This keeps the
 * page coherent: empty answers can't leak as confident sales claims.
 */

import { useEffect } from 'react'
import type { Lang } from '../i18n'
import { Header } from '../components/Header'
import { Footer } from '../components/Footer'
import { PageMast } from '../components/PageMast'
import { PAGE_FOLIOS } from '../lib/folios'
import { Runbook } from '../components/Runbook'
import { trackC } from '../lib/runbook/trackC'

const COPY = {
  fr: {
    pageTitle: 'Template du portail — Marc',
    metaDescription:
      'Le portail Marc, comme template pour les développeurs solo. Onze étapes du fork au premier client payant.',
    backHome: '← Retour à l’accueil',
    folio: `№ ${PAGE_FOLIOS.template} — le template`,
    stamp: 'TEMPLATE',
    stampSub: 'PORTAIL · SOLO',
    eyebrow: 'template',
    title: 'Le portail, comme point de départ',
    lead: 'C’est le code que je fais tourner sur marcportal.com — intake bilingue, paiements Stripe, mode dépositaire, conformité Loi 25. Si tu veux faire la même chose à ton nom, voici le chemin réaliste — pas une démo, pas un pitch.',

    salesCard: {
      whatTitle: 'Ce que tu reçois',
      whatItems: [
        'Le code source complet (React + Cloudflare Pages Functions + D1 + R2)',
        'Schéma D1 + 30+ migrations (sessions, paiements, vouches, audit)',
        'Templates de courriels bilingues (Resend) avec voix soignée',
        'Pages légales adaptables — base Loi 25 (Québec) + structure RGPD-compatible',
        'Ce runbook public (les 11 étapes ci-dessous) + RUNBOOK.md interne',
      ],
      youDoTitle: 'Ce que tu fais',
      youDoItems: [
        'Provisionner ton infra Cloudflare + Stripe + Resend',
        'Rebrand (nom, palette, copies) — 2 à 4 h',
        'Adapter le légal à ta juridiction',
        'Faire un test de fumée complet avant les premiers clients',
      ],
      timeTitle: 'Temps réaliste',
      timeBody: '6 à 10 heures de setup actif, étalé sur 1–2 semaines (KYC Stripe = inconnue).',
      priceTitle: 'Prix',
      pricePlaceholder: 'À décider (voir Décisions sur /admin/runbook)',
      licenseTitle: 'Licence',
      licensePlaceholder: 'À décider (voir Décisions sur /admin/runbook)',
      supportTitle: 'Support inclus',
      supportPlaceholder: 'À décider (voir Décisions sur /admin/runbook)',
    },

    timelineTitle: 'Les 11 étapes, en détail',
    timelineSub: 'De « j’ai cloné » à « mon premier inconnu paie ». Coche en avançant — sauvé localement.',

    finePrint:
      'Pas une garantie de conformité. Le template fournit la structure ; tu restes responsable de l’adapter à ta juridiction et à tes clients. La PIA (Loi 25) est un point de départ, pas un certificat.',
  },
  en: {
    pageTitle: 'Portal template — Marc',
    metaDescription:
      'The Marc portal, packaged as a template for solo developers. Eleven steps from fork to first paid client.',
    backHome: '← Back to home',
    folio: `№ ${PAGE_FOLIOS.template} — the template`,
    stamp: 'TEMPLATE',
    stampSub: 'PORTAL · SOLO',
    eyebrow: 'template',
    title: 'The portal, as a starting point',
    lead: 'This is the code I run on marcportal.com — bilingual intake, Stripe payments, custodian mode, Bill 25 compliance. If you want to do the same under your name, here’s the realistic path — not a demo, not a pitch.',

    salesCard: {
      whatTitle: 'What you get',
      whatItems: [
        'Full source code (React + Cloudflare Pages Functions + D1 + R2)',
        'D1 schema + 30+ migrations (sessions, payments, vouches, audit)',
        'Bilingual email templates (Resend) with a polished voice',
        'Adaptable legal pages — Bill 25 (Quebec) base + GDPR-compatible structure',
        'This public runbook (11 steps below) + internal RUNBOOK.md',
      ],
      youDoTitle: 'What you do',
      youDoItems: [
        'Provision your Cloudflare + Stripe + Resend infrastructure',
        'Rebrand (name, palette, copy) — 2 to 4 hours',
        'Adapt the legal pages to your jurisdiction',
        'Run a full smoke test before your first clients',
      ],
      timeTitle: 'Realistic time',
      timeBody: '6 to 10 hours of active setup, spread across 1–2 weeks (Stripe KYC is the unknown).',
      priceTitle: 'Price',
      pricePlaceholder: 'TBD (see Decisions on /admin/runbook)',
      licenseTitle: 'License',
      licensePlaceholder: 'TBD (see Decisions on /admin/runbook)',
      supportTitle: 'Support included',
      supportPlaceholder: 'TBD (see Decisions on /admin/runbook)',
    },

    timelineTitle: 'The 11 steps, in detail',
    timelineSub: 'From “I cloned it” to “my first stranger pays.” Check off as you go — saved locally.',

    finePrint:
      'Not a compliance guarantee. The template provides structure; you stay responsible for adapting it to your jurisdiction and your clients. The PIA (Bill 25) is a starting point, not a certificate.',
  },
} as const

export function Template({ lang }: { lang: Lang }) {
  const t = COPY[lang]

  useEffect(() => {
    document.title = t.pageTitle
    const meta = document.querySelector('meta[name="description"]')
    if (meta) meta.setAttribute('content', t.metaDescription)
  }, [t])

  const home = lang === 'en' ? '/en' : '/'

  return (
    <div className="page page--template">
      <Header lang={lang} />
      <main id="main-content">
        <PageMast
          folio={t.folio}
          stampLabel={t.stamp}
          stampSub={t.stampSub}
          back={{ href: home, label: t.backHome }}
        >
          <div className="section__eyebrow">{t.eyebrow}</div>
          <h1 className="page-mast__title">{t.title}</h1>
          <p className="page-mast__lead">{t.lead}</p>
        </PageMast>

        <section className="template-sales" aria-label={t.salesCard.whatTitle}>
          <div className="template-sales__grid">
            <article className="template-sales__col">
              <h2 className="template-sales__h">{t.salesCard.whatTitle}</h2>
              <ul className="template-sales__list">
                {t.salesCard.whatItems.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </article>
            <article className="template-sales__col">
              <h2 className="template-sales__h">{t.salesCard.youDoTitle}</h2>
              <ul className="template-sales__list">
                {t.salesCard.youDoItems.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </article>
          </div>

          <dl className="template-sales__meta">
            <div className="template-sales__meta-row">
              <dt>{t.salesCard.timeTitle}</dt>
              <dd>{t.salesCard.timeBody}</dd>
            </div>
            <div className="template-sales__meta-row">
              <dt>{t.salesCard.priceTitle}</dt>
              <dd className="template-sales__placeholder">{t.salesCard.pricePlaceholder}</dd>
            </div>
            <div className="template-sales__meta-row">
              <dt>{t.salesCard.licenseTitle}</dt>
              <dd className="template-sales__placeholder">{t.salesCard.licensePlaceholder}</dd>
            </div>
            <div className="template-sales__meta-row">
              <dt>{t.salesCard.supportTitle}</dt>
              <dd className="template-sales__placeholder">{t.salesCard.supportPlaceholder}</dd>
            </div>
          </dl>
        </section>

        <section className="template-timeline" aria-label={t.timelineTitle}>
          <header className="template-timeline__head">
            <h2 className="template-timeline__h">{t.timelineTitle}</h2>
            <p className="template-timeline__sub">{t.timelineSub}</p>
          </header>
          <Runbook track={trackC} lang={lang} initialView="summary" />
        </section>

        <p className="template-fineprint">{t.finePrint}</p>
      </main>
      <Footer lang={lang} />
    </div>
  )
}
