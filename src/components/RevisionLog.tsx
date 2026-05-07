import { useState } from 'react'
import type { Lang } from '../i18n'
import { DICT } from '../i18n'
import type { FeatureJson } from '../lib/showcases'
import { getRevisions } from '../lib/showcases'

/**
 * Reverse-chronological "what changed and when" log. Default collapsed with a count
 * summary; expandable. Each entry: date, author, fields_changed pills, reason.
 * Anchored in the actual revisions[] array — no theatrical entries.
 */
export function RevisionLog({ feature, lang }: { feature: FeatureJson; lang: Lang }) {
  const t = DICT[lang].showcase.revisionLog
  const [expanded, setExpanded] = useState(false)
  const revisions = getRevisions(feature)
  if (revisions.length === 0) return null

  return (
    <div className="rev-log">
      <button
        type="button"
        className="rev-log__toggle"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <span className="rev-log__toggle-arrow" aria-hidden="true">
          {expanded ? '▼' : '▶'}
        </span>
        {t.summary.replace('{n}', String(revisions.length))}
      </button>
      {expanded && (
        <ol className="rev-log__list">
          {revisions.map((rev, i) => (
            <li key={`${rev.date}-${i}`} className="rev-log__entry">
              <div className="rev-log__head">
                <span className="rev-log__date mono">{rev.date}</span>
                <span className="rev-log__author mono">{rev.author}</span>
                <span className="rev-log__fields">
                  {rev.fields_changed.map((f) => (
                    <span key={f} className="rev-log__pill mono">
                      {f}
                    </span>
                  ))}
                </span>
              </div>
              <p className="rev-log__reason">{rev.reason}</p>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
