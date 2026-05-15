import type { Lang } from '../i18n'

// Placeholder — full implementation in Phase 9 (Excalidraw whiteboard intake).
// The route is wired in main.tsx so the data-router migration can be tested
// end-to-end before the page itself exists.
export function Napkin({ lang }: { lang: Lang }) {
  return (
    <main className="page" aria-busy="true">
      <p style={{ padding: '40px', fontFamily: 'var(--mono)' }}>
        {lang === 'fr' ? 'À venir — napkin' : 'Coming soon — napkin'}
      </p>
    </main>
  )
}
