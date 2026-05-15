import type { Lang } from '../i18n'
import { DICT } from '../i18n'

/**
 * Editorial pull-quote between sections. Centered, large italic serif,
 * sage decorative quotes. Aside (not section) so it doesn't fight the
 * section rail's scrollspy.
 */
export function PullQuote({ lang }: { lang: Lang }) {
  const t = DICT[lang].pullQuote
  return (
    <aside className="pull-quote" aria-label="quote">
      <span className="pull-quote__mark" aria-hidden="true">
        “
      </span>
      <blockquote className="pull-quote__body">{t.body}</blockquote>
      <cite className="pull-quote__attribution mono">— {t.attribution}</cite>
    </aside>
  )
}
