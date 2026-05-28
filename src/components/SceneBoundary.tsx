import type { ReactElement, ReactNode } from 'react'
import { SentryErrorBoundary } from '../lib/sentry'

/**
 * Wrap an Excalidraw scene subtree (SketchCanvas / NapkinReplay) so a corrupt
 * or version-drifted scene degrades to `fallback` instead of throwing up to
 * the route-level errorElement and blanking the whole page.
 *
 * Why this exists: the only other boundary is react-router's
 * `errorElement={<RouteError/>}`, which catches a render throw but answers it
 * by replacing the entire page with the error screen. A single unrenderable
 * sketch element shouldn't take the session page with it — the napkin is a
 * snapshot, the rest of the session is the load-bearing part. The boundary
 * still reports to Sentry (tagged by surface) so we KNOW a scene failed to
 * hydrate; we just recover in place. Reachable failure: an Excalidraw element
 * shape this build can't render (scene saved by a newer/older Excalidraw).
 *
 * Reset is by remount: every call site renders this inside a conditional
 * (sceneOpen / isEditing / open), so toggling the affordance off and on
 * unmounts and re-creates the boundary fresh — no stuck error state, no need
 * to thread resetError out.
 */
export function SceneBoundary({
  surface,
  fallback,
  children,
}: {
  surface: string
  fallback: ReactElement
  children: ReactNode
}) {
  return (
    <SentryErrorBoundary
      fallback={fallback}
      beforeCapture={(scope) => scope.setTag('surface', surface)}
    >
      {children}
    </SentryErrorBoundary>
  )
}
