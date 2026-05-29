/**
 * /passage + /en/passage — "ton passage" receipt.
 *
 * Café-restaurant-bill rendering of the visitor's current tab session: what
 * mp_* cookies are set right now, what localStorage keys live in this
 * origin, what routes were walked through (from the visitTracker), and a
 * static "no third parties unless an error fires" note about who else heard
 * about the visit. Total: $0.00.
 *
 * The page is *deliberately not* the legal Loi 25 disclosure. /confidentialite
 * does that. This page is the felt version — the same information dressed
 * as a receipt the visitor can print and keep. Two registers, one truth.
 *
 * Available to signed-in and signed-out visitors alike. The receipt is more
 * sparse for a logged-out tab (no mp_session cookie, no /me localStorage
 * draft) — that's the right answer, not a degraded one.
 *
 * No data leaves the page. Cookies are read with document.cookie; storage
 * with window.localStorage; visit log with the in-tab sessionStorage helper.
 * Nothing is POSTed anywhere. The "Imprimer" button hands off to the
 * browser's print dialog.
 */

import { useEffect, useMemo } from 'react'
import type { Lang } from '../i18n'
import { Header } from '../components/Header'
import { Footer } from '../components/Footer'
import { PageMast } from '../components/PageMast'
import { SectionEyebrow } from '../components/SectionEyebrow'
import { PAGE_FEATURE } from '../lib/features'
import { PAGE_FOLIOS } from '../lib/folios'
import { readVisits, type VisitEntry } from '../lib/visitTracker'

const COPY = {
  fr: {
    pageTitle: 'Ton passage — Marc',
    metaDescription:
      'Reçu de ton passage sur marcportal — ce que les cookies, le stockage local et les pages parcourues révèlent de ta visite. Aucun envoi serveur.',
    eyebrow: 'loi 25 · ton passage en papier',
    title: 'Ton passage',
    folio: `№ ${PAGE_FOLIOS.passage} — ton passage`,
    stampLabel: 'REÇU',
    stampSub: 'AUCUN MONTANT DÛ',
    lead: 'Un reçu, comme au resto : voici ce que ton onglet sait de ta visite, en clair. Tu peux l’imprimer, le sauvegarder, ou simplement le lire et fermer l’onglet. Rien ici n’est envoyé à un serveur — tout est lu dans ton navigateur.',
    printCta: 'Imprimer le reçu',
    receiptHeader: 'Café Marc-Portal · Notre-Dame-de-Grâce, Québec',
    receiptDate: (d: string) => `Date : ${d}`,
    receiptVisit: (n: number) => `Passages dans cet onglet : ${n}`,
    cookiesHeading: 'Cookies servis à table',
    cookiesEmpty: 'Aucun cookie servi pour le moment — tu n’as pas encore demandé l’addition.',
    cookieDescriptions: {
      mp_session: 'Te reconnaît quand tu reviens (signé, HttpOnly, 7 jours).',
      mp_csrf: 'Anti-falsification de formulaire (lisible par le site, par session).',
      mp_lang: 'Ta langue préférée (30 jours).',
      mp_en_nudge_dismissed: 'Tu as déjà fait le choix d’anglais — on n’insiste plus.',
    } as Record<string, string>,
    cookieGeneric: 'Cookie d’usage interne au portail.',
    localStorageHeading: 'Mémo gardé dans ton navigateur',
    localStorageEmpty: 'Aucune note locale — ton navigateur ne garde rien de ce portail.',
    visitsHeading: 'Pages parcourues (dans cet onglet)',
    visitsEmpty:
      'Aucune page enregistrée — soit tu viens d’arriver, soit ton navigateur bloque le stockage de session.',
    visitsDwell: (ms: number) => formatDwellFr(ms),
    visitsActive: 'page courante',
    apisHeading: 'Demandes en cuisine (API)',
    apisBody:
      'Le portail appelle quelques routes publiques au chargement : /api/capacity (combien je peux prendre), /api/public/projects (la galerie), /api/public/vouches (les témoignages), /api/tenant (qui héberge cette page). Aucune analytique. Aucun pixel. Aucun suivi tiers.',
    thirdHeading: 'Tiers parties sollicitées',
    thirdBody:
      'Par défaut, aucune. Le journal d’erreurs Sentry s’active uniquement si quelque chose se brise pendant ta visite — et même là, ton courriel ou tes messages ne sont pas envoyés. Plus de détails dans la',
    thirdLink: 'fiche PIA',
    totalLine: 'Total : 0,00 $ · Merci de ton passage.',
    backHome: '← Retour à l’accueil',
    relatedHeading: 'Pour aller plus loin',
    relatedDossier: 'Ce que je détiens vraiment sur toi (le carnet) →',
    relatedPrivacy: 'La politique de confidentialité (la version légale) ↗',
    relatedPia: 'Comment je protège tes données (la fiche PIA) ↗',
  },
  en: {
    pageTitle: 'Your visit — Marc',
    metaDescription:
      'A receipt of your visit to marcportal — what cookies, local storage, and the pages you walked through say about it. Nothing leaves your browser.',
    eyebrow: 'bill 25 · your visit on paper',
    title: 'Your visit',
    folio: `№ ${PAGE_FOLIOS.passage} — your visit`,
    stampLabel: 'RECEIPT',
    stampSub: 'NOTHING DUE',
    lead: "A receipt, the way a café gives you one: here's what your tab knows about this visit, in plain words. Print it, save it, or just read it and close the tab. Nothing on this page is sent to a server — every detail is read from your own browser.",
    printCta: 'Print the receipt',
    receiptHeader: 'Café Marc-Portal · Notre-Dame-de-Grâce, Québec',
    receiptDate: (d: string) => `Date: ${d}`,
    receiptVisit: (n: number) => `Hops in this tab: ${n}`,
    cookiesHeading: 'Cookies served at the table',
    cookiesEmpty: 'No cookie served yet — you haven’t asked for the bill.',
    cookieDescriptions: {
      mp_session: 'Recognises you on return (signed, HttpOnly, 7 days).',
      mp_csrf: 'Form-forgery guard (site-readable, per session).',
      mp_lang: 'Your preferred language (30 days).',
      mp_en_nudge_dismissed: 'You already picked English — no more nudges.',
    } as Record<string, string>,
    cookieGeneric: 'Portal-internal cookie.',
    localStorageHeading: 'Notes kept in your browser',
    localStorageEmpty: 'No local notes — your browser is keeping nothing from this portal.',
    visitsHeading: 'Pages walked through (in this tab)',
    visitsEmpty:
      'No pages recorded yet — either you just arrived, or your browser blocks session storage.',
    visitsDwell: (ms: number) => formatDwellEn(ms),
    visitsActive: 'current page',
    apisHeading: 'Orders sent to the kitchen (APIs)',
    apisBody:
      'The portal calls a handful of public routes on load: /api/capacity (how much I can take), /api/public/projects (the gallery), /api/public/vouches (the testimonials), /api/tenant (who hosts this page). No analytics. No pixel. No third-party tracking.',
    thirdHeading: 'Third parties contacted',
    thirdBody:
      'By default, none. The Sentry error log only fires if something breaks during your visit — and even then, your email and messages aren’t sent. More in the',
    thirdLink: 'PIA record',
    totalLine: 'Total: $0.00 · Thanks for stopping by.',
    backHome: '← Back to the home',
    relatedHeading: 'Keep reading',
    relatedDossier: 'What I actually hold about you (the ledger) →',
    relatedPrivacy: 'The privacy policy (legal version) ↗',
    relatedPia: 'How I protect your data (PIA record) ↗',
  },
} as const

function formatDwellFr(ms: number): string {
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const rs = s % 60
  return rs ? `${m}m ${rs}s` : `${m}m`
}

function formatDwellEn(ms: number): string {
  return formatDwellFr(ms) // same format works in both
}

interface MpCookie {
  name: string
  value: string
}

function readMpCookies(): MpCookie[] {
  if (typeof document === 'undefined') return []
  const out: MpCookie[] = []
  for (const part of document.cookie.split(';')) {
    const trimmed = part.trim()
    if (!trimmed) continue
    const eq = trimmed.indexOf('=')
    const name = eq === -1 ? trimmed : trimmed.slice(0, eq)
    const value = eq === -1 ? '' : trimmed.slice(eq + 1)
    if (name.startsWith('mp_')) out.push({ name, value })
  }
  return out.sort((a, b) => a.name.localeCompare(b.name))
}

interface MpLocalEntry {
  key: string
  /** Best-effort one-line summary of what's in the value. We deliberately
   *  don't dump the value itself — drafts can be long, and the page should
   *  read clean. */
  summary: string
}

function readMpLocal(): MpLocalEntry[] {
  if (typeof window === 'undefined') return []
  try {
    const out: MpLocalEntry[] = []
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i)
      if (!key) continue
      if (!key.startsWith('mp_')) continue
      const raw = window.localStorage.getItem(key) ?? ''
      out.push({ key, summary: summarizeValue(raw) })
    }
    return out.sort((a, b) => a.key.localeCompare(b.key))
  } catch {
    return []
  }
}

function summarizeValue(raw: string): string {
  if (raw === '') return 'vide'
  if (raw === '1' || raw === 'true') return 'oui'
  if (raw === '0' || raw === 'false') return 'non'
  const len = raw.length
  if (raw.startsWith('{') || raw.startsWith('[')) return `~${len} caractères (JSON)`
  if (len > 40) return `${len} caractères`
  return raw
}

function formatReceiptDate(lang: Lang, d: Date): string {
  return new Intl.DateTimeFormat(lang === 'fr' ? 'fr-CA' : 'en-CA', {
    timeZone: 'America/Toronto',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(d)
}

export function Passage({ lang }: { lang: Lang }) {
  const t = COPY[lang]
  const langPrefix = lang === 'en' ? '/en' : ''
  const piaHref = lang === 'fr' ? '/pia' : '/en/pia'
  const privacyHref = lang === 'fr' ? '/confidentialite' : '/en/privacy'
  const dossierHref = `${langPrefix}/me/dossier`
  const homeHref = lang === 'fr' ? '/' : '/en'

  // Cookies / localStorage / visits are read once during render via useMemo.
  // Browser-only reads, but Vite's prerender boots Chromium so `window` is
  // available there too — no guard needed beyond the helpers' own typeof
  // checks. A receipt is a snapshot, not a dashboard, so we don't need to
  // keep these in state or refresh them.
  const cookies = useMemo<MpCookie[]>(() => readMpCookies(), [])
  const storage = useMemo<MpLocalEntry[]>(() => readMpLocal(), [])
  const visits = useMemo<VisitEntry[]>(() => readVisits(), [])

  // Use a single date for both display and dwell-time math so a re-render
  // doesn't shift values around mid-read.
  const receiptDate = useMemo(() => new Date(), [])
  const formattedDate = useMemo(() => formatReceiptDate(lang, receiptDate), [lang, receiptDate])

  useEffect(() => {
    document.title = t.pageTitle
    const meta = document.querySelector('meta[name="description"]')
    if (meta) meta.setAttribute('content', t.metaDescription)
  }, [t])

  const onPrint = () => {
    window.print()
  }

  return (
    <div className="app" data-feature={PAGE_FEATURE['page.passage']}>
      <Header lang={lang} />
      <main id="main-content">
        <article className="section">
          <div className="section__inner passage">
            <PageMast
              folio={t.folio}
              stampLabel={t.stampLabel}
              stampSub={t.stampSub}
              back={{ href: homeHref, label: t.backHome }}
              feature={PAGE_FEATURE['page.passage']}
              lang={lang}
            >
              <SectionEyebrow lang={lang} feature={PAGE_FEATURE['page.passage']}>
                {t.eyebrow}
              </SectionEyebrow>
              <h1>{t.title}</h1>
              <p className="passage__lead">{t.lead}</p>
              <p>
                <button type="button" className="hero__cta passage__print" onClick={onPrint}>
                  {t.printCta}
                </button>
              </p>
            </PageMast>

            <section className="surface passage-receipt" aria-label={t.receiptHeader}>
              <header className="passage-receipt__head">
                <p className="passage-receipt__café mono">{t.receiptHeader}</p>
                <p className="passage-receipt__meta mono">
                  <span>{t.receiptDate(formattedDate)}</span>
                  <span>{t.receiptVisit(visits.length)}</span>
                </p>
              </header>

              <section className="passage-receipt__block">
                <h2 className="passage-receipt__title mono">{t.cookiesHeading}</h2>
                {cookies.length === 0 ? (
                  <p className="passage-receipt__empty">{t.cookiesEmpty}</p>
                ) : (
                  <ul className="passage-receipt__rows">
                    {cookies.map((c) => (
                      <li key={c.name} className="passage-receipt__row">
                        <span className="passage-receipt__row-name mono">{c.name}</span>
                        <span className="passage-receipt__row-note">
                          {t.cookieDescriptions[c.name] ?? t.cookieGeneric}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="passage-receipt__block">
                <h2 className="passage-receipt__title mono">{t.localStorageHeading}</h2>
                {storage.length === 0 ? (
                  <p className="passage-receipt__empty">{t.localStorageEmpty}</p>
                ) : (
                  <ul className="passage-receipt__rows">
                    {storage.map((e) => (
                      <li key={e.key} className="passage-receipt__row">
                        <span className="passage-receipt__row-name mono">{e.key}</span>
                        <span className="passage-receipt__row-note">{e.summary}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="passage-receipt__block">
                <h2 className="passage-receipt__title mono">{t.visitsHeading}</h2>
                {visits.length === 0 ? (
                  <p className="passage-receipt__empty">{t.visitsEmpty}</p>
                ) : (
                  <ol className="passage-receipt__rows passage-receipt__rows--visits">
                    {visits.map((v, i) => {
                      const isLast = i === visits.length - 1
                      return (
                        <li
                          key={`${v.path}-${v.enteredAt}`}
                          className="passage-receipt__row passage-receipt__row--visit"
                        >
                          <span className="passage-receipt__row-name mono">{v.path}</span>
                          <span className="passage-receipt__row-note mono">
                            {isLast
                              ? t.visitsActive
                              : v.dwellMs !== undefined
                                ? t.visitsDwell(v.dwellMs)
                                : ''}
                          </span>
                        </li>
                      )
                    })}
                  </ol>
                )}
              </section>

              <section className="passage-receipt__block">
                <h2 className="passage-receipt__title mono">{t.apisHeading}</h2>
                <p className="passage-receipt__prose">{t.apisBody}</p>
              </section>

              <section className="passage-receipt__block">
                <h2 className="passage-receipt__title mono">{t.thirdHeading}</h2>
                <p className="passage-receipt__prose">
                  {t.thirdBody} <a href={piaHref}>{t.thirdLink}</a>.
                </p>
              </section>

              <footer className="passage-receipt__total mono">
                <p>{t.totalLine}</p>
              </footer>
            </section>

            <aside className="passage__related">
              <h2 className="passage__related-heading">{t.relatedHeading}</h2>
              <ul className="passage__related-list">
                <li>
                  <a href={dossierHref}>{t.relatedDossier}</a>
                </li>
                <li>
                  <a href={privacyHref}>{t.relatedPrivacy}</a>
                </li>
                <li>
                  <a href={piaHref}>{t.relatedPia}</a>
                </li>
              </ul>
            </aside>
          </div>
        </article>
      </main>
      <Footer lang={lang} />
    </div>
  )
}
