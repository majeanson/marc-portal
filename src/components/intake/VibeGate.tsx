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
      <label className="checkbox">
        <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
        <span>{t.intake.vibe.confirm}</span>
      </label>
      <button
        type="button"
        className="hero__cta"
        disabled={!agreed}
        onClick={onAccept}
        style={{ opacity: agreed ? 1 : 0.4, cursor: agreed ? 'pointer' : 'not-allowed' }}
      >
        {t.intake.vibe.cta}
      </button>
    </div>
  )
}
