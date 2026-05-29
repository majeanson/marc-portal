import { useEffect, useRef, useState } from 'react'
import type { Lang } from '../i18n'
import { DICT } from '../i18n'

// Some older lib.dom.d.ts surfaces don't declare navigator.share; in newer
// TS it's there but typed as required. Type-check by reading it off a
// `unknown` cast to keep the call sites portable.
type ShareFn = (data: { url?: string; title?: string; text?: string }) => Promise<void>
function getNativeShare(): ShareFn | null {
  if (typeof navigator === 'undefined') return null
  const fn = (navigator as unknown as { share?: ShareFn }).share
  return typeof fn === 'function' ? fn.bind(navigator) : null
}

/**
 * Visitor-facing share affordance for /share/:id. Shows the live OG card
 * preview (the same PNG bots will scrape and display in chat) alongside a
 * copy-to-clipboard URL input. Opens the native share sheet on platforms
 * that support it (Web Share API — most mobile, some desktop).
 *
 * Why preview the OG card? Two reasons: (1) it tells the visitor "yes,
 * this is what your DM will look like" before they hit send — anxiety-
 * killer; (2) it doubles as a visual confirmation that this project has
 * been formally curated (the card is editorial, not generic).
 */
export function ShareModal({
  lang,
  sessionId,
  open,
  onClose,
}: {
  lang: Lang
  sessionId: string
  open: boolean
  onClose: () => void
}) {
  const t = DICT[lang].sessionAdvancements
  const closeBtnRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const [copied, setCopied] = useState(false)

  const langPrefix = lang === 'en' ? '/en' : ''
  const shareUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}${langPrefix}/share/${sessionId}`
      : `${langPrefix}/share/${sessionId}`
  const ogUrl = `/og/share/${sessionId}${lang === 'en' ? '?lang=en' : ''}`

  // Focus the close button when the modal opens; restore focus on close.
  useEffect(() => {
    if (!open) return
    const previouslyFocused = document.activeElement as HTMLElement | null
    closeBtnRef.current?.focus()
    return () => {
      previouslyFocused?.focus()
    }
  }, [open])

  // Escape key dismisses. Captured at the dialog level so it doesn't escape
  // to other handlers (TimeTravelScrubber has its own arrow-key listener).
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const onCopy = async () => {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard blocked — URL is still visible in the input */
    }
  }

  const nativeShare = getNativeShare()
  const onNative = async () => {
    if (!nativeShare) return
    try {
      await nativeShare({ url: shareUrl, title: t.heading })
    } catch {
      /* user cancelled or share failed — no-op */
    }
  }

  return (
    <div
      className="share-modal__backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={dialogRef}
        className="surface share-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-modal-title"
      >
        <header className="share-modal__head">
          <h2 id="share-modal-title" className="share-modal__title">
            {t.shareModalTitle}
          </h2>
          <button
            ref={closeBtnRef}
            type="button"
            className="share-modal__close"
            onClick={onClose}
            aria-label={t.shareClose}
          >
            ✕
          </button>
        </header>
        <p className="share-modal__sub">{t.shareModalSub}</p>

        <div className="share-modal__preview-frame">
          <img
            className="share-modal__preview-img"
            src={ogUrl}
            alt={t.sharePreviewAlt}
            width={1200}
            height={630}
            loading="eager"
          />
        </div>

        <div className="share-modal__row">
          <input
            type="text"
            className="input share-modal__url mono"
            value={shareUrl}
            readOnly
            onFocus={(e) => e.currentTarget.select()}
            aria-label={t.shareHeading}
          />
          <button type="button" className="share-modal__copy" onClick={onCopy}>
            {copied ? t.shareCopied : t.shareCopy}
          </button>
        </div>

        {nativeShare && (
          <button type="button" className="share-modal__native mono" onClick={onNative}>
            {t.shareNative}
          </button>
        )}
      </div>
    </div>
  )
}
