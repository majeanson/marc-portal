/**
 * The napkin as a through-line. Pinned at the top of the session so the
 * sketch the visitor arrived with stays present the whole way through.
 * Once the session ships, the panel becomes a from-sketch-to-shipped
 * pairing — first scribble beside what it became.
 *
 * Copy comes from the parent's SessionPage local COPY (Pick<>'d here) so
 * the page keeps wording authority while this file owns the layout.
 */

import type { Lang } from '../../i18n'
import type { AdvancementRow } from '../../lib/advancementsApi'
import type { SessionRow } from '../../lib/sessionsApi'
import { NapkinSection, type ParsedNapkin } from './NapkinSection'

export interface NapkinArcCopy {
  arcShippedHeading: string
  arcPinnedHeading: string
  arcSketchLabel: string
  arcShippedLabel: string
  arcShippedFallback: string
  arcViewLive: string
}

export function NapkinArc({
  lang,
  copy,
  napkin,
  session,
  currentBuild,
  onNapkinReplaced,
}: {
  lang: Lang
  copy: NapkinArcCopy
  napkin: ParsedNapkin
  session: SessionRow
  currentBuild: AdvancementRow | null
  /** Bubbled into NapkinSection to enable the re-upload affordance.
   *  Parent (SessionPage) re-fetches the session so the new napkin URL
   *  renders. When omitted, NapkinSection hides the "redo" button. */
  onNapkinReplaced?: () => void
}) {
  const shipped = session.status === 'shipped'
  const buildHref = currentBuild?.build_url
    ? `${currentBuild.build_url}${currentBuild.iframe_path ?? ''}`
    : null
  return (
    <section
      className="intake__step session-frame__panel session-arc"
      data-shipped={shipped || undefined}
    >
      <h2>{shipped ? copy.arcShippedHeading : copy.arcPinnedHeading}</h2>
      <div className="session-arc__pair">
        <div className="session-arc__col">
          {shipped && <span className="mono session-arc__col-label">{copy.arcSketchLabel}</span>}
          <NapkinSection
            lang={lang}
            napkin={napkin}
            sessionId={session.id}
            onReplaced={onNapkinReplaced}
          />
        </div>
        {shipped && (
          <>
            <div className="session-arc__arrow" aria-hidden="true">
              →
            </div>
            <div className="session-arc__col session-arc__col--shipped">
              <span className="mono session-arc__col-label">{copy.arcShippedLabel}</span>
              <div className="session-arc__shipped">
                <h3 className="session-arc__shipped-title">
                  {session.showcase_title?.trim() || copy.arcShippedFallback}
                </h3>
                {session.showcase_tagline?.trim() && (
                  <p className="session-arc__shipped-tagline">{session.showcase_tagline}</p>
                )}
                {buildHref && (
                  <a
                    className="mono session-arc__shipped-link"
                    href={buildHref}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {copy.arcViewLive}
                  </a>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  )
}
