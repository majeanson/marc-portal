import { useEffect, useMemo, useRef, useState } from 'react'
import type { Lang } from '../i18n'
import { DICT } from '../i18n'
import { VOICE_CLIPS, parseTranscript, buildInvoice } from '../lib/sndParser'
import type { ParseResult } from '../lib/sndParser'
import { getShowcaseBySlug } from '../lib/showcases'
import { StatusHistoryStrip } from '../components/StatusHistoryStrip'
import { RevisionLog } from '../components/RevisionLog'

const SND_SLUG = 'sunday-night-dread'
const REPO_URL = 'https://github.com/majeanson/marc-portal'

/**
 * Sunday Night Dread — interactive static demo. Iframe-friendly (no Header/Footer)
 * so it embeds cleanly into the showcase page. 3 voice clip fixtures, real parser
 * (regex + bilingual lexicon), real invoice math (labor rate, GST, QST).
 */
export function SndDemo({ lang }: { lang: Lang }) {
  const dict = DICT[lang]
  const t = dict.sndDemo
  const [played, setPlayed] = useState<Set<string>>(new Set())
  const [showInvoice, setShowInvoice] = useState(false)
  const audioRefs = useRef<Record<string, HTMLAudioElement | null>>({})
  // The feature.json behind this demo is the source of truth for its own
  // lifecycle + revision log. Pulling it in lets the demo show its own
  // build provenance alongside the interactive flow.
  const sndEntry = getShowcaseBySlug(SND_SLUG)

  useEffect(() => {
    document.documentElement.lang = dict.langCode
    document.title = `${t.pageTitle} — Marc`
  }, [dict, t])

  const parses = useMemo<Array<{ clipId: string; client: string; result: ParseResult }>>(() => {
    return VOICE_CLIPS.filter((c) => played.has(c.id)).map((c) => ({
      clipId: c.id,
      client: c.client,
      result: parseTranscript(c.transcript[lang === 'fr' ? 'fr' : 'fr']),
    }))
  }, [played, lang])

  const invoiceByClient = useMemo(() => {
    const byClient: Record<string, ReturnType<typeof buildInvoice>> = {}
    for (const c of VOICE_CLIPS) {
      if (!played.has(c.id)) continue
      const result = parseTranscript(c.transcript.fr)
      const existing = byClient[c.client]
      if (existing) {
        // Already have one for this client — merge by rebuilding from all of theirs
        const allForClient = parses.filter((p) => p.client === c.client).map((p) => p.result)
        byClient[c.client] = buildInvoice(c.client, '2026-05-04', allForClient)
      } else {
        byClient[c.client] = buildInvoice(c.client, '2026-05-04', [result])
      }
    }
    return byClient
  }, [played, parses])

  const togglePlay = (id: string) => {
    const audio = audioRefs.current[id]
    setPlayed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
        if (audio) {
          audio.pause()
          audio.currentTime = 0
        }
      } else {
        next.add(id)
        // .play() returns a promise that rejects on autoplay policy / missing file.
        // We swallow rejections so a missing audio file degrades gracefully to text-only.
        audio?.play().catch(() => {})
      }
      return next
    })
    setShowInvoice(false)
  }

  return (
    <div className="snd-demo">
      <header className="snd-demo__header">
        <div className="section__eyebrow">{t.eyebrow}</div>
        <h1 className="snd-demo__title">{t.title}</h1>
        <p className="snd-demo__intro">{t.intro}</p>
        {sndEntry && (
          <StatusHistoryStrip
            feature={sndEntry.feature}
            lang={lang}
            targetShipDate={sndEntry.showcase.targetShipDate}
          />
        )}
      </header>

      <section className="snd-demo__panel">
        <h2 className="snd-demo__h">{t.clipsTitle}</h2>
        <p className="snd-demo__hint">{t.clipsHint}</p>

        <ul className="snd-demo__clips">
          {VOICE_CLIPS.map((clip) => {
            const isPlayed = played.has(clip.id)
            return (
              <li key={clip.id} className={`snd-clip${isPlayed ? ' snd-clip--played' : ''}`}>
                <button
                  type="button"
                  className="snd-clip__btn"
                  onClick={() => togglePlay(clip.id)}
                  aria-pressed={isPlayed}
                  aria-label={`${isPlayed ? t.transcriptLabel : 'Play'} — ${clip.weekday[lang]} ${clip.client}`}
                >
                  <span className="snd-clip__icon mono">{isPlayed ? '⏸' : '▶'}</span>
                  <span className="snd-clip__meta">
                    <span className="snd-clip__when mono">
                      {clip.weekday[lang]} · {clip.time[lang]} · {clip.jobLabel[lang]}
                    </span>
                    <span className="snd-clip__client">
                      {t.atClient.replace('{name}', clip.client)}
                    </span>
                  </span>
                </button>
                {clip.audioSrc && (
                  // The transcript is rendered immediately below the audio when played,
                  // serving the same purpose as a captions track for this static demo.
                  // eslint-disable-next-line jsx-a11y/media-has-caption
                  <audio
                    ref={(el) => {
                      audioRefs.current[clip.id] = el
                    }}
                    src={clip.audioSrc}
                    preload="none"
                  />
                )}
                {isPlayed && (
                  <div className="snd-clip__transcript">
                    <div className="snd-clip__transcript-label mono">{t.transcriptLabel}</div>
                    <p>"{clip.transcript[lang]}"</p>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </section>

      {parses.length > 0 && (
        <section className="snd-demo__panel">
          <h2 className="snd-demo__h">{t.parsedTitle}</h2>
          <p className="snd-demo__hint">{t.parsedHint}</p>
          <div className="snd-parsed">
            {parses.map(({ clipId, client, result }) => (
              <div key={clipId} className="snd-parsed__card">
                <div className="snd-parsed__head mono">
                  {client} · {result.hours ?? '—'}h · {result.jobType ?? '—'}
                </div>
                <ul className="snd-parsed__list">
                  {result.materials.map((m, i) => (
                    <li key={i}>
                      <span className="mono" style={{ color: 'var(--accent-warm)' }}>
                        {m.quantity ?? '—'}
                        {m.unit ? ' ' + m.unit : ''}
                      </span>{' '}
                      {m.item}
                    </li>
                  ))}
                  {result.materials.length === 0 && (
                    <li style={{ color: 'var(--text-soft)' }}>—</li>
                  )}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}

      {parses.length > 0 && (
        <section className="snd-demo__panel">
          <h2 className="snd-demo__h">{t.invoiceTitle}</h2>
          <p className="snd-demo__hint">{t.invoiceHint}</p>
          {!showInvoice ? (
            <button type="button" className="hero__cta" onClick={() => setShowInvoice(true)}>
              {t.generate}
            </button>
          ) : (
            <div className="snd-invoices">
              {Object.entries(invoiceByClient).map(([client, invoice]) => (
                <div key={client} className="snd-invoice">
                  <div className="snd-invoice__email mono">
                    <div>{t.emailFrom}</div>
                    <div>{t.emailTo.replace('{client}', client)}</div>
                    <div>{t.emailSubject.replace('{client}', client)}</div>
                  </div>
                  <div className="snd-invoice__body">
                    <p>{t.invoiceGreeting.replace('{client}', client)}</p>
                    <p>{t.invoiceLead}</p>
                    <table className="snd-invoice__table">
                      <thead>
                        <tr>
                          <th>{t.col_desc}</th>
                          <th>{t.col_qty}</th>
                          <th>{t.col_unit}</th>
                          <th>{t.col_total}</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td>{t.laborRow.replace('{rate}', String(invoice.laborRate))}</td>
                          <td className="mono">{invoice.hoursTotal}h</td>
                          <td className="mono">${invoice.laborRate.toFixed(2)}</td>
                          <td className="mono">${invoice.laborSubtotal.toFixed(2)}</td>
                        </tr>
                        {invoice.materialLines.map((line, i) => (
                          <tr key={i}>
                            <td>{line.description}</td>
                            <td className="mono">
                              {line.quantity}
                              {line.unit ? ' ' + line.unit : ''}
                            </td>
                            <td className="mono">${line.unitPrice.toFixed(2)}</td>
                            <td className="mono">${line.lineTotal.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td colSpan={3}>{t.subtotal}</td>
                          <td className="mono">${invoice.subtotal.toFixed(2)}</td>
                        </tr>
                        <tr>
                          <td colSpan={3}>TPS (5%)</td>
                          <td className="mono">${invoice.gst.toFixed(2)}</td>
                        </tr>
                        <tr>
                          <td colSpan={3}>TVQ (9.975%)</td>
                          <td className="mono">${invoice.qst.toFixed(2)}</td>
                        </tr>
                        <tr className="snd-invoice__total">
                          <td colSpan={3}>{t.total}</td>
                          <td className="mono">${invoice.total.toFixed(2)}</td>
                        </tr>
                      </tfoot>
                    </table>
                    <p className="snd-invoice__sign">{t.invoiceSign}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {sndEntry && (
        <section className="snd-demo__panel snd-demo__buildlog">
          <h2 className="snd-demo__h">{t.buildLogTitle}</h2>
          <p className="snd-demo__hint">{t.buildLogHint}</p>
          <RevisionLog
            feature={sndEntry.feature}
            lang={lang}
            iframePath={lang === 'en' ? '/en/demo/sunday-night-dread' : '/demo/sunday-night-dread'}
            repoUrl={REPO_URL}
          />
        </section>
      )}

      <footer className="snd-demo__footer">
        <p className="mono">{t.disclaimer}</p>
      </footer>
    </div>
  )
}
