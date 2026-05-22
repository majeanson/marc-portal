import { useCallback, useEffect, useRef, useState } from 'react'
import type { Lang } from '../i18n'
import { DICT } from '../i18n'

/**
 * Voice note recorder — shared by the intake form and the session thread.
 *
 * Context-agnostic on purpose: the caller supplies the consent line (the
 * intake's clip is transcribed-and-discarded, a message's clip is retained,
 * so the wording differs) and the confirm-button label. The recorder itself
 * only knows how to capture audio, show a preview, and hand the blob back.
 *
 * Graceful degrade is the rule: no MediaRecorder, no microphone, or a denied
 * permission all land on a quiet error state with a retry — the caller's
 * typed/written path is always still there underneath.
 */

/** Container formats to try, best first. Opus-in-WebM is small and what
 *  Chrome + Firefox produce; Safari falls through to mp4. */
const MIME_CANDIDATES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/ogg;codecs=opus',
  'audio/mp4',
]

function pickMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return ''
  for (const c of MIME_CANDIDATES) {
    try {
      if (MediaRecorder.isTypeSupported(c)) return c
    } catch {
      // isTypeSupported can throw on exotic engines — treat as unsupported.
    }
  }
  return ''
}

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

type Phase = 'idle' | 'recording' | 'recorded' | 'error'

export interface VoiceRecorderProps {
  lang: Lang
  /** Contextual consent line shown above the record button. */
  consent: string
  /** Label for the confirm button once a clip has been recorded. */
  confirmLabel: string
  /** True while the caller is uploading/transcribing the handed-back blob. */
  busy?: boolean
  /** Fired when the visitor confirms the clip they recorded. */
  onRecorded: (blob: Blob) => void
  /** Fired when the visitor backs out without a clip. */
  onCancel: () => void
  /** Hard cap on clip length. Auto-stops at the limit. */
  maxSeconds?: number
}

export function VoiceRecorder({
  lang,
  consent,
  confirmLabel,
  busy = false,
  onRecorded,
  onCancel,
  maxSeconds = 120,
}: VoiceRecorderProps) {
  const t = DICT[lang].media.voice
  const [phase, setPhase] = useState<Phase>('idle')
  const [elapsed, setElapsed] = useState(0)
  const [blob, setBlob] = useState<Blob | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<BlobPart[]>([])
  const timerRef = useRef<number | null>(null)

  // Release the mic track + the interval. Safe to call repeatedly.
  const teardown = useCallback(() => {
    if (timerRef.current != null) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }
    streamRef.current?.getTracks().forEach((tr) => tr.stop())
    streamRef.current = null
  }, [])

  // Drop everything on unmount: stop the recorder, free the mic.
  useEffect(() => {
    return () => {
      try {
        if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
      } catch {
        // already stopped
      }
      teardown()
    }
  }, [teardown])

  // Revoke the preview object URL when it changes and on unmount, so the
  // recorded blob doesn't leak.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  const stop = useCallback(() => {
    try {
      if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
    } catch {
      // ignore — onstop still fires or the recorder was already done
    }
  }, [])

  const start = useCallback(async () => {
    const mimeType = pickMimeType()
    if (!mimeType || typeof navigator === 'undefined' || !navigator.mediaDevices) {
      setPhase('error')
      return
    }
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      // NotAllowedError (denied) / NotFoundError (no mic) / insecure context.
      setPhase('error')
      return
    }
    streamRef.current = stream
    chunksRef.current = []

    const recorder = new MediaRecorder(stream, { mimeType })
    recorderRef.current = recorder
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data)
    }
    recorder.onstop = () => {
      teardown()
      const recorded = new Blob(chunksRef.current, { type: mimeType })
      chunksRef.current = []
      if (recorded.size === 0) {
        setPhase('error')
        return
      }
      setBlob(recorded)
      setPreviewUrl(URL.createObjectURL(recorded))
      setPhase('recorded')
    }

    recorder.start()
    setElapsed(0)
    setPhase('recording')
    timerRef.current = window.setInterval(() => {
      setElapsed((prev) => {
        const next = prev + 1
        if (next >= maxSeconds) stop()
        return next
      })
    }, 1000)
  }, [maxSeconds, stop, teardown])

  const reset = useCallback(() => {
    setBlob(null)
    setPreviewUrl(null)
    setElapsed(0)
    setPhase('idle')
  }, [])

  return (
    <div className="voice-rec" aria-live="polite">
      {phase === 'idle' && (
        <div className="voice-rec__idle">
          <p className="voice-rec__consent">{consent}</p>
          <div className="voice-rec__actions">
            <button type="button" className="voice-rec__btn voice-rec__btn--rec" onClick={start}>
              <span className="voice-rec__dot" aria-hidden="true" /> {t.record}
            </button>
            <button type="button" className="link-btn mono" onClick={onCancel}>
              {t.cancel}
            </button>
          </div>
        </div>
      )}

      {phase === 'recording' && (
        <div className="voice-rec__live">
          <span className="voice-rec__pulse" aria-hidden="true" />
          <span className="mono voice-rec__timer">
            {t.recording} {formatElapsed(elapsed)} / {formatElapsed(maxSeconds)}
          </span>
          <button type="button" className="voice-rec__btn voice-rec__btn--stop" onClick={stop}>
            {t.stop}
          </button>
        </div>
      )}

      {phase === 'recorded' && previewUrl && (
        <div className="voice-rec__done">
          {/* No caption track: this is a transient self-review of the clip the
              visitor just recorded — there is no caption file for it, and the
              recording is about to become a transcript anyway. */}
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <audio className="voice-rec__preview" src={previewUrl} controls preload="metadata" />
          <span className="mono voice-rec__len">{formatElapsed(elapsed)}</span>
          <div className="voice-rec__actions">
            <button
              type="button"
              className="voice-rec__btn voice-rec__btn--use"
              disabled={busy || !blob}
              onClick={() => blob && onRecorded(blob)}
            >
              {busy ? t.working : confirmLabel}
            </button>
            <button type="button" className="link-btn mono" onClick={reset} disabled={busy}>
              {t.rerecord}
            </button>
          </div>
        </div>
      )}

      {phase === 'error' && (
        <div className="voice-rec__error">
          <p className="voice-rec__error-msg">{t.error}</p>
          <div className="voice-rec__actions">
            <button type="button" className="link-btn mono" onClick={reset}>
              {t.retry}
            </button>
            <button type="button" className="link-btn mono" onClick={onCancel}>
              {t.cancel}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
