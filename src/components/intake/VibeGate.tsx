import { useState } from 'react'
import type { Lang } from '../../i18n'
import { DICT } from '../../i18n'

export function VibeGate({ lang, onAccept }: { lang: Lang; onAccept: () => void }) {
  const t = DICT[lang]
  const [agreed, setAgreed] = useState(false)
  return (
    <div className="intake__step">
      <div className="section__eyebrow">{t.intake.vibe.eyebrow}</div>
      <h2>{t.vibe.title}</h2>
      <p>{t.vibe.body}</p>
      <div className="vibe">
        <div className="vibe__col vibe__col--do">
          <h3>{t.vibe.do.title}</h3>
          <ul>
            {t.vibe.do.items.map((it) => (
              <li key={it}>{it}</li>
            ))}
          </ul>
        </div>
        <div className="vibe__col vibe__col--dont">
          <h3>{t.vibe.dont.title}</h3>
          <ul>
            {t.vibe.dont.items.map((it) => (
              <li key={it}>{it}</li>
            ))}
          </ul>
        </div>
      </div>
      {/* Non-blocking ack: the checkbox is a hand-shake, not a gate.
          When checked, the label swaps to a quirky "thanks for reading"
          micro-confirmation. The CTA works either way — server-side
          /triage is the real filter, not this form. */}
      <label className={`checkbox vibe__ack${agreed ? ' vibe__ack--checked' : ''}`}>
        <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
        <span>{agreed ? t.intake.vibe.ackThanks : t.intake.vibe.confirm}</span>
      </label>
      <button type="button" className="hero__cta" onClick={onAccept}>
        {t.intake.vibe.cta}
      </button>
    </div>
  )
}
