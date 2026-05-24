/**
 * The visitor's intake-time napkin sketch, rendered inside SessionPage's
 * intake panel. Full-width PNG at rest; toggles into a pan/zoom Excalidraw
 * canvas (<NapkinReplay/>) when the editable scene is present and the
 * visitor clicks "open interactive."
 *
 * Extracted from SessionPage so the toggle state + the sketch-vs-png
 * decision live next to the affordance, not in a 1900-line page render.
 */

import { useState } from 'react'
import { DICT, type Lang } from '../../i18n'
import type { NapkinScene } from '../../lib/napkin'
import { NapkinReplay } from '../NapkinReplay'

export interface ParsedNapkin {
  png: string
  text: string
  savedAt: string
  /** Editable Excalidraw scene, present on intakes submitted after the
   *  napkin was folded into the form. Older sessions only have the flat PNG. */
  scene?: NapkinScene
}

export function NapkinSection({ lang, napkin }: { lang: Lang; napkin: ParsedNapkin }) {
  const t = DICT[lang].napkin
  const hasScene = !!napkin.scene && napkin.scene.elements.length > 0
  const [sceneOpen, setSceneOpen] = useState(false)
  return (
    <div className="session-napkin">
      <div className="session-napkin__head">
        <span className="section__eyebrow">{t.eyebrow}</span>
        <div className="session-napkin__actions">
          {hasScene && (
            <button
              type="button"
              className="mono session-napkin__toggle"
              onClick={() => setSceneOpen((open) => !open)}
            >
              {sceneOpen ? t.sceneHide : t.sceneOpen}
            </button>
          )}
          <a
            className="mono session-napkin__open"
            href={napkin.png}
            target="_blank"
            rel="noreferrer"
            download={`napkin-${napkin.savedAt.slice(0, 10) || 'sketch'}.png`}
          >
            {t.pillView} ↗
          </a>
        </div>
      </div>
      {napkin.text && <p className="session-napkin__caption">{napkin.text}</p>}
      <div className="session-napkin__frame">
        {sceneOpen && napkin.scene ? (
          <NapkinReplay lang={lang} scene={napkin.scene} />
        ) : (
          <img
            src={napkin.png}
            alt={napkin.text || 'Napkin sketch'}
            className="session-napkin__img"
          />
        )}
      </div>
    </div>
  )
}
