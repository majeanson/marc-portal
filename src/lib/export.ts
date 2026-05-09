/**
 * Client-side data export. Walks the visitor's sessions, fetches each
 * thread, and bundles the lot into a single JSON file. The visitor can
 * archive it or send it to whoever; the format is intentionally
 * self-describing (top-level metadata block).
 *
 * Admin path is identical — the listSessions endpoint returns whatever
 * the viewer is allowed to see, so the same call works either way.
 */

import { listMessages, listSessions, type MessageRow, type SessionRow } from './sessionsApi'

export interface ExportBundle {
  /** Constant marker so future readers can detect the format. */
  exportFormat: 'marc-portal-export-v1'
  exportedAt: string
  exportedBy: string
  sessions: Array<{ session: SessionRow; messages: MessageRow[] }>
}

export async function exportMyData(viewerEmail: string): Promise<ExportBundle> {
  const { sessions } = await listSessions()
  // Sequential fetch — keeps the request burst polite and avoids tripping
  // the messages-POST rate limit on the GET path (which is uncapped, but
  // we still don't need 50 parallel sockets).
  const enriched: ExportBundle['sessions'] = []
  for (const session of sessions) {
    try {
      const { messages } = await listMessages(session.id)
      enriched.push({ session, messages })
    } catch {
      enriched.push({ session, messages: [] })
    }
  }
  return {
    exportFormat: 'marc-portal-export-v1',
    exportedAt: new Date().toISOString(),
    exportedBy: viewerEmail,
    sessions: enriched,
  }
}

/** Trigger a browser download of the bundle as a JSON file. */
export function downloadJson(bundle: ExportBundle): void {
  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const stamp = new Date().toISOString().slice(0, 10)
  a.href = url
  a.download = `marc-portal-export-${stamp}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Defer revoke so the click has time to register.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
