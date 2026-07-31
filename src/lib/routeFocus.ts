/**
 * Decides whether a route-change effect (see RootLayout in router.tsx)
 * should move focus to <main id="main-content"> after a client-side
 * navigation. Hash-only navigations — in-page section anchors, the session
 * tab bar's #session-conversation-style deep links — already manage their
 * own scroll position via the browser's native anchor-jump behavior;
 * stealing focus onto <main> on top of that would fight it and leave
 * keyboard/screen-reader users disoriented mid-anchor-jump.
 *
 * Pulled out as a pure function (rather than inlined in the effect) so the
 * skip rule is unit-testable without standing up a full data router —
 * ScrollRestoration and the lazy-route Suspense timing don't have a clean
 * story under happy-dom (see MEMORY: no router-level tests exist yet).
 */
export function shouldFocusMainOnRouteChange(hash: string): boolean {
  return hash === ''
}
