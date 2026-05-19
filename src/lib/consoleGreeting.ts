/**
 * One-shot bilingual console banner for visitors who pop open devtools.
 * Most are recruiters, fellow devs, or curious tinkerers — Marc's voice is
 * dry and handmade, so the message stays terse with a contact hook.
 *
 * Idempotent — guarded against HMR re-imports in dev so the console doesn't
 * fill up with duplicate greetings on every save.
 */
export function printConsoleGreeting(): void {
  if (typeof window === 'undefined' || typeof console === 'undefined') return
  const w = window as unknown as { __marcGreeted?: boolean }
  if (w.__marcGreeted) return
  w.__marcGreeted = true

  const serif = 'font: 600 14px/1.5 "Source Serif 4", Georgia, serif; color: #b27c2d;'
  const dim = 'font: 400 12px/1.5 "Source Serif 4", Georgia, serif; color: #8a7c66;'
  const mono = 'font: 500 12px/1.5 "JetBrains Mono", monospace; color: #181613;'

  console.log(
    "%c👋 Salut, t'es dans la console.\n%cHi, you opened the console.\n\n%cMarc-Antoine — Québec, async, soir et fin de semaine.\n%cmarc@marcportal.com",
    serif,
    dim,
    dim,
    mono,
  )
}
