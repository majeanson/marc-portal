import type { Lang } from '../i18n'
import { TYPE_SHORT, getSchemaForType, type ProblemType } from './intakeSchemas'

const MAX_EXCERPT = 48

/**
 * Human title for a submitted request: the type, then the start of the first
 * free-text answer (« Suivi · Club de course du dimanche »). Requests used to
 * be named by their 8-char id, which tells a client nothing about which of
 * their twelve requests they are looking at. The id stays on screen as a small
 * tag. Null when the payload doesn't parse, so callers keep their own fallback
 * (« Demande sans titre »).
 */
export function requestTitle(raw: string | null, lang: Lang): string | null {
  if (!raw) return null
  let obj: { type?: unknown; formData?: unknown }
  try {
    obj = JSON.parse(raw) as typeof obj
  } catch {
    return null
  }
  if (typeof obj.type !== 'string' || !(obj.type in TYPE_SHORT)) return null
  const type = obj.type as ProblemType
  const label = TYPE_SHORT[type][lang]
  const data = obj.formData && typeof obj.formData === 'object' ? obj.formData : {}
  for (const field of getSchemaForType(type).fields) {
    if (field.type !== 'text' && field.type !== 'textarea') continue
    const v = (data as Record<string, unknown>)[field.id]
    if (typeof v !== 'string') continue
    const flat = v.replace(/\s+/g, ' ').trim()
    if (!flat) continue
    return `${label} · ${excerpt(flat)}`
  }
  return label
}

/** Cut at a word boundary so a title never ends mid-word. */
function excerpt(s: string): string {
  if (s.length <= MAX_EXCERPT) return s
  const cut = s.slice(0, MAX_EXCERPT)
  const lastSpace = cut.lastIndexOf(' ')
  return `${(lastSpace > 20 ? cut.slice(0, lastSpace) : cut).replace(/[.,;:!?]+$/, '')}…`
}
