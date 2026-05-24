/**
 * A single sketch attachment rendered inside a message thread. Renders the
 * "✎ sketch" tile with an expand/collapse toggle; on first reveal, fetches
 * the Excalidraw scene JSON from R2 and pipes it into <NapkinReplay/>.
 *
 * Extracted from SessionPage.tsx so the sketch-tile logic — its own fetch
 * state, the failed-fetch fallback, the lazy reveal — lives next to the
 * affordance instead of buried in the page's render tree.
 */

import { useState } from 'react'
import { DICT, type Lang } from '../../i18n'
import { attachmentUrl, type AttachmentRow } from '../../lib/attachmentsApi'
import type { NapkinScene } from '../../lib/napkin'
import { NapkinReplay } from '../NapkinReplay'

export function SketchAttachment({
  att,
  sessionId,
  lang,
}: {
  att: AttachmentRow
  sessionId: string
  lang: Lang
}) {
  const tm = DICT[lang].media.thread
  const [open, setOpen] = useState(false)
  const [scene, setScene] = useState<NapkinScene | null>(null)
  const [failed, setFailed] = useState(false)

  const reveal = async () => {
    setOpen(true)
    if (scene || failed) return
    try {
      const res = await fetch(attachmentUrl(sessionId, att.id), { credentials: 'same-origin' })
      if (!res.ok) {
        setFailed(true)
        return
      }
      const json = (await res.json()) as { elements?: unknown }
      if (json && Array.isArray(json.elements)) setScene({ elements: json.elements })
      else setFailed(true)
    } catch {
      setFailed(true)
    }
  }

  return (
    <li className="thread__attach-tile thread__attach-tile--sketch">
      <div className="thread__sketch-head">
        <span className="mono thread__sketch-label">✎ {tm.sketchLabel}</span>
        <button
          type="button"
          className="link-btn mono"
          onClick={open ? () => setOpen(false) : reveal}
        >
          {open ? tm.sketchClose : tm.sketchOpen}
        </button>
      </div>
      {open && scene && <NapkinReplay lang={lang} scene={scene} />}
      {open && !scene && !failed && (
        <div className="napkin__loading mono">{DICT[lang].napkin.loadingCanvas}</div>
      )}
      {open && failed && <p className="mono thread__transcript-pending">—</p>}
    </li>
  )
}
