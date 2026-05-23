/**
 * /au-revoir + /en/goodbye — the erasure ritual.
 *
 * Final page in the "ton passage" arc, fired after a successful DELETE
 * /api/me. The /me page sets sessionStorage['mp_just_erased'] = '1' just
 * before navigating here; we read that flag once on mount.
 *
 * Behaviour:
 *   - flag present → play the 3-second fade-to-paper animation, clear the
 *     flag, then settle on a quiet "c’est fait" line. No CTA. The visitor
 *     is meant to leave.
 *   - flag absent (someone navigated directly) → render a quiet "ton compte
 *     est déjà parti" message with a link home. No animation; the ritual
 *     belongs to the act of erasure itself, not to the URL.
 *
 * The animation is opacity-only. CSS handles it via the .au-revoir__token
 * classes; this component does nothing fancy beyond mounting six labels
 * that represent the broad categories of data that vanished. Why six and
 * not the exact row count: the visitor is gone — querying the DB for what
 * we used to have is impossible by design. The categories are honest in
 * shape if not in count.
 *
 * Reduced-motion: when the visitor's OS prefers no motion, the animation
 * is skipped (the labels render at zero opacity from the start). The body
 * line "c’est fait" stands alone. Same emotional weight, no flicker.
 */

import { useEffect, useState } from 'react'
import type { Lang } from '../i18n'
import { Header } from '../components/Header'
import { Footer } from '../components/Footer'
import { PAGE_FEATURE } from '../lib/features'
import { consumeJustErasedFlag } from '../lib/erasureFlag'
import { clearVisits } from '../lib/visitTracker'

/**
 * Resolve the just-erased branch once per mount.
 *
 * React Concurrent Mode + StrictMode both re-invoke the useState lazy
 * initializer multiple times during a single mount cycle. A side-
 * effecting initializer that *consumes* sessionStorage would therefore
 * read '1' on the first call and `null` on the second, settling on
 * `false` every time. This was the original bug — the ritual silently
 * never fired, in dev or prod.
 *
 * The fix: a module-level "claim slot" that caches the read result
 * for the duration of one mount, so the SECOND initializer call
 * returns the same value as the first instead of re-reading an empty
 * sessionStorage. The slot is reset in useEffect cleanup so a fresh
 * mount (navigate away and back) gets to claim again.
 */
let claimSlotInUse = false
let claimSlotValue = false

function claimErasureFlag(): boolean {
  if (!claimSlotInUse) {
    claimSlotInUse = true
    claimSlotValue = consumeJustErasedFlag()
  }
  return claimSlotValue
}

function releaseClaimSlot(): void {
  claimSlotInUse = false
  claimSlotValue = false
}

const COPY = {
  fr: {
    pageTitle: 'Au revoir — Marc',
    metaDescription: "Le compte vient d'être effacé. Toutes les données sont parties.",
    titleRitual: "C'est fait.",
    bodyRitual: "Tu n'es plus dans le carnet.",
    titleDirect: 'Au revoir.',
    bodyDirect: "Ton compte est déjà parti, ou tu n'en avais pas. Aucune trace ici.",
    tokens: [
      'ton courriel',
      'tes sessions',
      'tes messages',
      'tes pièces jointes',
      'tes brouillons',
      'tes préférences',
    ],
    homeCta: "Retour à l'accueil",
  },
  en: {
    pageTitle: 'Goodbye — Marc',
    metaDescription: 'The account was just erased. Every piece of data is gone.',
    titleRitual: "It's done.",
    bodyRitual: 'You are no longer in the ledger.',
    titleDirect: 'Goodbye.',
    bodyDirect: 'Your account is already gone, or you never had one. No trace here.',
    tokens: [
      'your email',
      'your sessions',
      'your messages',
      'your attachments',
      'your drafts',
      'your preferences',
    ],
    homeCta: 'Back to home',
  },
} as const

export function AuRevoir({ lang }: { lang: Lang }) {
  const t = COPY[lang]
  const homeHref = lang === 'fr' ? '/' : '/en'

  // useState's lazy initializer is called multiple times by React in
  // dev (StrictMode) AND prod (Concurrent Mode reveal). claimErasureFlag
  // caches the first result so all subsequent calls return the same
  // value within one mount. See the comment block above for the why.
  const [justErased] = useState<boolean>(claimErasureFlag)
  useEffect(() => releaseClaimSlot, [])

  useEffect(() => {
    document.title = t.pageTitle
    const meta = document.querySelector('meta[name="description"]')
    if (meta) meta.setAttribute('content', t.metaDescription)
  }, [t])

  useEffect(() => {
    if (justErased) {
      // Wipe the visit log on the ritual branch — a freshly-deleted visitor
      // shouldn't carry forward an in-tab trail from before the erasure.
      // Effect (not a render-time call) because clearVisits writes to
      // sessionStorage; render-time mutation of external state is the
      // exact thing useEffect is for.
      clearVisits()
    }
  }, [justErased])

  if (!justErased) {
    return (
      <div className="app" data-feature={PAGE_FEATURE['page.au-revoir']}>
        <Header lang={lang} variant="session" />
        <main id="main-content" className="au-revoir au-revoir--direct">
          <h1 className="au-revoir__title">{t.titleDirect}</h1>
          <p className="au-revoir__body">{t.bodyDirect}</p>
          <p>
            <a href={homeHref} className="au-revoir__home">
              ← {t.homeCta}
            </a>
          </p>
        </main>
        <Footer lang={lang} />
      </div>
    )
  }

  return (
    <div className="app" data-feature={PAGE_FEATURE['page.au-revoir']}>
      <Header lang={lang} variant="session" />
      <main id="main-content" className="au-revoir au-revoir--ritual">
        {/* Six tokens fading from solid ink to paper over ~3s. CSS does
            the work; staggered per child by --token-delay. */}
        <ol className="au-revoir__tokens" aria-hidden="true">
          {t.tokens.map((label, i) => (
            <li
              key={label}
              className="au-revoir__token mono"
              style={{ ['--token-delay' as string]: `${i * 0.18}s` }}
            >
              {label}
            </li>
          ))}
        </ol>

        <h1 className="au-revoir__title">{t.titleRitual}</h1>
        <p className="au-revoir__body">{t.bodyRitual}</p>
        <p>
          <a href={homeHref} className="au-revoir__home">
            ← {t.homeCta}
          </a>
        </p>
      </main>
      <Footer lang={lang} />
    </div>
  )
}
