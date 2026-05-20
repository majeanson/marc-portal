import type { ReactNode } from 'react'
import type { Lang } from '../../i18n'
import type { FeatureId } from '../../lib/features'
import { SectionEyebrow } from '../SectionEyebrow'

/**
 * Shared page header used by the session detail surface: small eyebrow on
 * top (with its feature dot), big title underneath, optional meta row.
 *
 * The eyebrow goes through <SectionEyebrow> so it carries the same
 * clickable feature dot every other section title on the site does —
 * `feature` is whatever the caller's surface belongs to (a session detail
 * is the conversation feature).
 */
export function SessionHeader({
  eyebrow,
  title,
  idTag,
  meta,
  lang,
  feature,
}: {
  /** Mono uppercase line above the title. e.g. "session · in progress". */
  eyebrow: string
  /** Big page heading. */
  title: string
  /** Optional short id tag rendered next to the title (e.g. first 8 chars). */
  idTag?: string
  /** Optional meta row rendered under the title (status pill, SLA, etc.). */
  meta?: ReactNode
  lang: Lang
  /** Feature this surface belongs to — drives the eyebrow's dot color. */
  feature?: FeatureId
}) {
  return (
    <header className="session-frame__header">
      <SectionEyebrow lang={lang} feature={feature}>
        {eyebrow}
      </SectionEyebrow>
      <h1 className="session-frame__title">
        {title}
        {idTag && <span className="mono session-frame__id"> {idTag}</span>}
      </h1>
      {meta && <div className="session-frame__meta">{meta}</div>}
    </header>
  )
}
