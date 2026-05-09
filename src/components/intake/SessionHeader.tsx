import type { ReactNode } from 'react'

/**
 * Shared page header used by /intake confirmation and /session/:id so both
 * surfaces present a session the same way: small mono eyebrow on top, big
 * title underneath, optional meta row trailing.
 */
export function SessionHeader({
  eyebrow,
  title,
  idTag,
  meta,
}: {
  /** Mono uppercase line above the title. e.g. "session · in progress". */
  eyebrow: string
  /** Big page heading. */
  title: string
  /** Optional short id tag rendered next to the title (e.g. first 8 chars). */
  idTag?: string
  /** Optional meta row rendered under the title (status pill, SLA, etc.). */
  meta?: ReactNode
}) {
  return (
    <header className="session-frame__header">
      <div className="section__eyebrow">{eyebrow}</div>
      <h1 className="session-frame__title">
        {title}
        {idTag && <span className="mono session-frame__id"> {idTag}</span>}
      </h1>
      {meta && <div className="session-frame__meta">{meta}</div>}
    </header>
  )
}
