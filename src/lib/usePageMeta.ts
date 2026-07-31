import { useEffect } from 'react'
import type { Lang } from '../i18n'
import { DICT } from '../i18n'

// useLangSwitch navigates client-side (cookie + history push, no reload —
// see useLangSwitch.ts), so document.title/documentElement.lang/meta-
// description only ever update if the new page's own effect sets them.
// Half the page components never touched documentElement.lang at all,
// which meant `<html lang>` stayed on whatever the last page picked after
// every FR<->EN switch. One hook, called by every page, closes that gap
// instead of relying on each component to remember all three assignments.
//
// Description cleanup matters because the tag is shared page-to-page:
// leaving a stale description in the DOM after unmount means the NEXT
// page's crawl/share snapshot can carry a description that belongs to
// the page the visitor just left. Title and lang are left alone on
// unmount — the incoming page's own usePageMeta call sets those before
// the old one has a chance to matter.
export function usePageMeta({
  title,
  description,
  lang,
}: {
  title: string
  description?: string
  lang: Lang
}) {
  useEffect(() => {
    document.title = title
    document.documentElement.lang = DICT[lang].langCode

    if (description === undefined) return

    const existing = document.querySelector('meta[name="description"]')
    const previousContent = existing?.getAttribute('content') ?? null
    const tagPreexisted = existing !== null
    const meta = existing ?? document.createElement('meta')
    if (!tagPreexisted) {
      meta.setAttribute('name', 'description')
      document.head.appendChild(meta)
    }
    meta.setAttribute('content', description)

    return () => {
      if (tagPreexisted) {
        meta.setAttribute('content', previousContent ?? '')
      } else {
        meta.remove()
      }
    }
  }, [title, description, lang])
}
