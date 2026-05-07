import type { Lang } from '../../i18n'
import { DICT } from '../../i18n'

export function EngagementPreview({
  lang,
  livePreviewUrl,
  livePreviewNote,
}: {
  lang: Lang
  livePreviewUrl: string | null
  livePreviewNote: { fr: string; en: string }
}) {
  const t = DICT[lang].engagement.preview
  const note = livePreviewNote[lang] ?? livePreviewNote.fr
  return (
    <section className="eng-preview">
      <h3 className="eng-preview__title">{t.title}</h3>
      <p className="eng-preview__note">{note}</p>
      {livePreviewUrl ? (
        <iframe
          className="eng-preview__iframe"
          src={livePreviewUrl}
          title={t.iframeTitle}
          loading="lazy"
          sandbox="allow-scripts allow-same-origin allow-forms"
        />
      ) : (
        <div className="eng-preview__placeholder mono">{t.notDeployedYet}</div>
      )}
    </section>
  )
}
