import type { Lang } from '../../i18n'
import { DICT } from '../../i18n'
import type { EngagementMessage } from '../../lib/engagements'

export function EngagementThread({
  lang,
  messages,
}: {
  lang: Lang
  messages: EngagementMessage[]
}) {
  const t = DICT[lang].engagement.thread
  return (
    <ol className="eng-thread" aria-label={t.label}>
      {messages.map((m) => {
        const body = m.body[lang] ?? m.body.fr
        return (
          <li key={m.id} className={`eng-msg eng-msg--${m.author} eng-msg--${m.type}`}>
            <div className="eng-msg__head mono">
              <span className="eng-msg__author">{t.authors[m.author]}</span>
              <span className="eng-msg__type">{t.types[m.type]}</span>
              <span className="eng-msg__date">{m.date}</span>
            </div>
            <p className="eng-msg__body">{body}</p>
          </li>
        )
      })}
    </ol>
  )
}
