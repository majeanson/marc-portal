import { useState } from 'react'
import type { Lang } from '../i18n'
import { DICT } from '../i18n'
import type { FeatureJson, FeatureRevision } from '../lib/showcases'
import { getRevisions } from '../lib/showcases'

/**
 * Reverse-chronological "what changed and when" log. Default collapsed with a count
 * summary; expandable. Each entry: date, author, fields_changed pills, reason.
 *
 * When a revision carries a buildUrl AND `iframePath` is provided, a "view this
 * build" toggle appears that opens an iframe pointed at <buildUrl><iframePath> —
 * a real, scrollable preview of the deployment at that revision (Cloudflare
 * Pages preview URLs). The iframe sandbox mirrors the showcase iframe.
 *
 * When a revision carries a `commit` SHA AND `repoUrl` is provided, a small
 * monospace "commit abc1234" link is rendered to the GitHub commit page.
 */
export function RevisionLog({
  feature,
  lang,
  iframePath,
  repoUrl,
}: {
  feature: FeatureJson
  lang: Lang
  /** Path appended to a revision's buildUrl to focus the iframe (e.g. "/demo/sunday-night-dread"). Required for the iframe toggle to render. */
  iframePath?: string
  /** GitHub repo URL (e.g. https://github.com/majeanson/marc-portal). Required for commit links to render. */
  repoUrl?: string
}) {
  const t = DICT[lang].showcase.revisionLog
  const [expanded, setExpanded] = useState(false)
  const [openBuild, setOpenBuild] = useState<number | null>(null)
  const revisions = getRevisions(feature)
  if (revisions.length === 0) return null

  return (
    <div className="rev-log">
      <button
        type="button"
        className="rev-log__toggle"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <span className="rev-log__toggle-arrow" aria-hidden="true">
          {expanded ? '▼' : '▶'}
        </span>
        {t.summary.replace('{n}', String(revisions.length))}
      </button>
      {expanded && (
        <ol className="rev-log__list">
          {revisions.map((rev, i) => (
            <RevisionEntry
              key={`${rev.date}-${i}`}
              rev={rev}
              t={t}
              iframePath={iframePath}
              repoUrl={repoUrl}
              isOpen={openBuild === i}
              onToggleBuild={() => setOpenBuild(openBuild === i ? null : i)}
            />
          ))}
        </ol>
      )}
    </div>
  )
}

function RevisionEntry({
  rev,
  t,
  iframePath,
  repoUrl,
  isOpen,
  onToggleBuild,
}: {
  rev: FeatureRevision
  t: {
    viewBuild: string
    hideBuild: string
    openInNewTab: string
    buildHint: string
    commitLabel: string
  }
  iframePath?: string
  repoUrl?: string
  isOpen: boolean
  onToggleBuild: () => void
}) {
  const canShowBuild = !!rev.buildUrl && !!iframePath
  const commitHref = rev.commit && repoUrl ? `${repoUrl}/commit/${rev.commit}` : null
  const iframeSrc = canShowBuild ? `${rev.buildUrl}${iframePath}` : null

  return (
    <li className="rev-log__entry">
      <div className="rev-log__head">
        <span className="rev-log__date mono">{rev.date}</span>
        <span className="rev-log__author mono">{rev.author}</span>
        <span className="rev-log__fields">
          {rev.fields_changed.map((f) => (
            <span key={f} className="rev-log__pill mono">
              {f}
            </span>
          ))}
        </span>
      </div>
      <p className="rev-log__reason">{rev.reason}</p>
      {(canShowBuild || commitHref) && (
        <div className="rev-log__build-row">
          {canShowBuild && (
            <button
              type="button"
              className="rev-log__build-toggle mono"
              onClick={onToggleBuild}
              aria-expanded={isOpen}
            >
              {isOpen ? t.hideBuild : t.viewBuild}
            </button>
          )}
          {iframeSrc && (
            <a
              className="rev-log__open-tab mono"
              href={iframeSrc}
              target="_blank"
              rel="noreferrer"
            >
              {t.openInNewTab}
            </a>
          )}
          {commitHref && (
            <a className="rev-log__commit mono" href={commitHref} target="_blank" rel="noreferrer">
              {t.commitLabel} {rev.commit?.slice(0, 7)}
            </a>
          )}
        </div>
      )}
      {isOpen && iframeSrc && (
        <div className="rev-log__build-frame">
          <p className="rev-log__build-hint mono">{t.buildHint}</p>
          <iframe
            src={iframeSrc}
            title={`Build ${rev.date}`}
            loading="lazy"
            sandbox="allow-scripts allow-same-origin allow-forms"
          />
        </div>
      )}
    </li>
  )
}
