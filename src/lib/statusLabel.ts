import type { Lang } from '../i18n'
import type { SessionStatus } from './sessionsApi'

/** The `draft` row status means "submitted, waiting for my reply": a session
 *  row only exists once the visitor pressed Soumettre (the unsent form lives
 *  in the intake autosave, not in sessions). Showing « Brouillon » / DRAFT
 *  after the Reçu card told them "c'est reçu" read as "you never sent it", so
 *  the client-facing word is « Reçue ». The DB enum stays `draft`. */
export const STATUS_LABEL: Record<Lang, Record<SessionStatus, string>> = {
  fr: {
    draft: 'reçue',
    triage: 'en triage',
    active: 'en cours',
    shipped: 'livrée',
    rejected: 'refusée',
  },
  en: {
    draft: 'received',
    triage: 'in triage',
    active: 'in progress',
    shipped: 'shipped',
    // "declined", not "rejected": the one EN word for this state on every
    // visitor-facing surface.
    rejected: 'declined',
  },
}
