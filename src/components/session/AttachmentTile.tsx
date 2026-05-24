/**
 * One attachment in a message thread, rendered as a tile. Three real cases:
 *   - voice → inline <audio> player + collapsible transcript
 *   - sketch → delegate to <SketchAttachment/> (lazy-reveal Excalidraw scene)
 *   - everything else → image preview if image/*, otherwise a download row
 *
 * Extracted from SessionPage so each attachment kind reads as its own clause
 * instead of fighting for space in the thread render.
 */

import { DICT, type Lang } from '../../i18n'
import { attachmentUrl, formatFileSize, type AttachmentRow } from '../../lib/attachmentsApi'
import { SketchAttachment } from './SketchAttachment'

export function AttachmentTile({
  att,
  sessionId,
  lang,
  openLabel,
}: {
  att: AttachmentRow
  sessionId: string
  lang: Lang
  openLabel: string
}) {
  const url = attachmentUrl(sessionId, att.id)
  const tm = DICT[lang].media.thread

  // Voice note — an inline player plus the edge transcript (collapsed; Marc
  // reads to scan, listens when a session is borderline).
  if (att.kind === 'voice') {
    return (
      <li className="thread__attach-tile thread__attach-tile--voice">
        <div className="thread__voice">
          <span className="mono thread__voice-label">🎙 {tm.voiceLabel}</span>
          {/* No caption track for a visitor-recorded clip — the edge transcript
              rendered just below is the accessible text equivalent. */}
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <audio className="thread__voice-player" src={url} controls preload="metadata" />
        </div>
        {att.transcript ? (
          <details className="thread__transcript">
            <summary className="mono thread__transcript-label">{tm.transcriptLabel}</summary>
            <p className="thread__transcript-text">{att.transcript}</p>
          </details>
        ) : (
          <p className="mono thread__transcript-pending">{tm.transcriptPending}</p>
        )}
      </li>
    )
  }

  if (att.kind === 'sketch') {
    return <SketchAttachment att={att} sessionId={sessionId} lang={lang} />
  }

  const isImage = att.content_type.startsWith('image/')
  if (isImage) {
    return (
      <li className="thread__attach-tile thread__attach-tile--image">
        <a href={url} target="_blank" rel="noopener noreferrer" aria-label={att.filename}>
          <img src={url} alt={att.filename} loading="lazy" />
        </a>
        <div className="thread__attach-caption mono">
          {att.filename} · {formatFileSize(att.size)}
        </div>
      </li>
    )
  }
  return (
    <li className="thread__attach-tile thread__attach-tile--file">
      <a href={url} target="_blank" rel="noopener noreferrer" download={att.filename}>
        <span className="thread__attach-icon" aria-hidden="true">
          ⎙
        </span>
        <span className="thread__attach-info">
          <span className="thread__attach-filename">{att.filename}</span>
          <span className="mono thread__attach-meta">
            {att.content_type} · {formatFileSize(att.size)}
          </span>
        </span>
        <span className="mono thread__attach-open">{openLabel} →</span>
      </a>
    </li>
  )
}
