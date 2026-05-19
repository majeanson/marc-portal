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
      {/* Same poster treatment as the homepage VibeFilter — `.vibe--ledger`
          drives the two-column layout, the SVG marks sit in each column's
          top-right corner at low opacity (decorative, never over the text),
          and each list item gets its own ✓ / ✗ glyph from CSS ::before.
          No text-decoration: the words must stay readable on both sides. */}
      <div className="vibe vibe--ledger">
        <div className="vibe__col vibe__col--do">
          <svg
            className="vibe__mark vibe__mark--do"
            viewBox="0 0 100 100"
            aria-hidden="true"
            focusable="false"
          >
            <path
              d="M 12 54 Q 26 70 38 78 Q 46 82 54 72 Q 72 48 92 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="9"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <h3>{t.vibe.do.title}</h3>
          <ul>
            {t.vibe.do.items.map((it) => (
              <li key={it}>{it}</li>
            ))}
          </ul>
        </div>
        <div className="vibe__rule" aria-hidden="true" />
        <div className="vibe__col vibe__col--dont">
          <svg
            className="vibe__mark vibe__mark--dont"
            viewBox="0 0 100 100"
            aria-hidden="true"
            focusable="false"
          >
            <path
              d="M 18 22 Q 50 48 84 80"
              fill="none"
              stroke="currentColor"
              strokeWidth="10"
              strokeLinecap="round"
            />
            <path
              d="M 84 22 Q 52 50 18 80"
              fill="none"
              stroke="currentColor"
              strokeWidth="10"
              strokeLinecap="round"
            />
          </svg>
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
