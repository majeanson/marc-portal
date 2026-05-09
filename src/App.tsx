import { Suspense, lazy, type ReactNode } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
// Hot-path pages — keep eager so the home/intake/login critical path stays
// fast and FCP-friendly.
import { RootByTemplate } from './pages/RootByTemplate'
import { Intake } from './pages/Intake'
import { Login } from './pages/Login'
import { MagicLinkSent } from './pages/MagicLinkSent'
import { MePortal } from './pages/MePortal'
import { SessionPage } from './pages/SessionPage'

// Cold-path pages — lazy. Cuts the initial bundle (showcase, demos, all admin
// surfaces) at the cost of one network round-trip when first visited.
const Showcase = lazy(() => import('./pages/Showcase').then((m) => ({ default: m.Showcase })))
const SndDemo = lazy(() => import('./pages/SndDemo').then((m) => ({ default: m.SndDemo })))
const Engagement = lazy(() => import('./pages/Engagement').then((m) => ({ default: m.Engagement })))
const Tier0 = lazy(() => import('./pages/Tier0').then((m) => ({ default: m.Tier0 })))
const AdminInbox = lazy(() => import('./pages/AdminInbox').then((m) => ({ default: m.AdminInbox })))
const AdminTrash = lazy(() => import('./pages/AdminTrash').then((m) => ({ default: m.AdminTrash })))
const Admin = lazy(() => import('./pages/Admin').then((m) => ({ default: m.Admin })))
const AdminAppearance = lazy(() =>
  import('./pages/AdminAppearance').then((m) => ({ default: m.AdminAppearance })),
)
const AdminTeam = lazy(() => import('./pages/AdminTeam').then((m) => ({ default: m.AdminTeam })))
const AdminBilling = lazy(() =>
  import('./pages/AdminBilling').then((m) => ({ default: m.AdminBilling })),
)
const AdminFleet = lazy(() => import('./pages/AdminFleet').then((m) => ({ default: m.AdminFleet })))
const AdminFleetNew = lazy(() =>
  import('./pages/AdminFleetNew').then((m) => ({ default: m.AdminFleetNew })),
)
const AdminAudit = lazy(() => import('./pages/AdminAudit').then((m) => ({ default: m.AdminAudit })))

function L({ children }: { children: ReactNode }) {
  // Minimal fallback — just the page chrome would require importing Header,
  // which beats the point. Empty main is fine: lazy chunks load fast on
  // same-host navigation.
  return <Suspense fallback={<main className="page" aria-busy="true" />}>{children}</Suspense>
}

export function App() {
  return (
    <Routes>
      <Route path="/" element={<RootByTemplate lang="fr" />} />
      <Route path="/en" element={<RootByTemplate lang="en" />} />
      <Route path="/intake" element={<Intake lang="fr" />} />
      <Route path="/en/intake" element={<Intake lang="en" />} />
      <Route
        path="/tier-0"
        element={
          <L>
            <Tier0 lang="fr" />
          </L>
        }
      />
      <Route
        path="/en/tier-0"
        element={
          <L>
            <Tier0 lang="en" />
          </L>
        }
      />
      <Route
        path="/demo/sunday-night-dread"
        element={
          <L>
            <SndDemo lang="fr" />
          </L>
        }
      />
      <Route
        path="/en/demo/sunday-night-dread"
        element={
          <L>
            <SndDemo lang="en" />
          </L>
        }
      />
      <Route
        path="/showcase/:slug"
        element={
          <L>
            <Showcase lang="fr" />
          </L>
        }
      />
      <Route
        path="/en/showcase/:slug"
        element={
          <L>
            <Showcase lang="en" />
          </L>
        }
      />
      <Route
        path="/engagement/:slug"
        element={
          <L>
            <Engagement lang="fr" />
          </L>
        }
      />
      <Route
        path="/en/engagement/:slug"
        element={
          <L>
            <Engagement lang="en" />
          </L>
        }
      />

      {/* Engagement runtime — feat-2026-015 */}
      <Route path="/login" element={<Login lang="fr" />} />
      <Route path="/en/login" element={<Login lang="en" />} />
      <Route path="/login/sent" element={<MagicLinkSent lang="fr" />} />
      <Route path="/en/login/sent" element={<MagicLinkSent lang="en" />} />
      <Route path="/me" element={<MePortal lang="fr" />} />
      <Route path="/en/me" element={<MePortal lang="en" />} />
      <Route path="/session/:id" element={<SessionPage lang="fr" />} />
      <Route path="/en/session/:id" element={<SessionPage lang="en" />} />
      <Route
        path="/admin/inbox"
        element={
          <L>
            <AdminInbox lang="fr" />
          </L>
        }
      />
      <Route
        path="/en/admin/inbox"
        element={
          <L>
            <AdminInbox lang="en" />
          </L>
        }
      />
      <Route
        path="/admin/trash"
        element={
          <L>
            <AdminTrash lang="fr" />
          </L>
        }
      />
      <Route
        path="/en/admin/trash"
        element={
          <L>
            <AdminTrash lang="en" />
          </L>
        }
      />
      <Route path="/admin/inbox/:id" element={<SessionPage lang="fr" />} />
      <Route path="/en/admin/inbox/:id" element={<SessionPage lang="en" />} />

      {/* Admin shell — fleet feat-2026-016. */}
      <Route
        path="/admin"
        element={
          <L>
            <Admin lang="fr" />
          </L>
        }
      >
        <Route index element={<Navigate to="/admin/apparence" replace />} />
        <Route
          path="apparence"
          element={
            <L>
              <AdminAppearance lang="fr" />
            </L>
          }
        />
        <Route
          path="equipe"
          element={
            <L>
              <AdminTeam lang="fr" />
            </L>
          }
        />
        <Route
          path="facturation"
          element={
            <L>
              <AdminBilling lang="fr" />
            </L>
          }
        />
        <Route
          path="fleet"
          element={
            <L>
              <AdminFleet lang="fr" />
            </L>
          }
        />
        <Route
          path="fleet/new"
          element={
            <L>
              <AdminFleetNew lang="fr" />
            </L>
          }
        />
        <Route
          path="audit"
          element={
            <L>
              <AdminAudit lang="fr" />
            </L>
          }
        />
      </Route>
      <Route
        path="/en/admin"
        element={
          <L>
            <Admin lang="en" />
          </L>
        }
      >
        <Route index element={<Navigate to="/en/admin/apparence" replace />} />
        <Route
          path="apparence"
          element={
            <L>
              <AdminAppearance lang="en" />
            </L>
          }
        />
        <Route
          path="equipe"
          element={
            <L>
              <AdminTeam lang="en" />
            </L>
          }
        />
        <Route
          path="facturation"
          element={
            <L>
              <AdminBilling lang="en" />
            </L>
          }
        />
        <Route
          path="fleet"
          element={
            <L>
              <AdminFleet lang="en" />
            </L>
          }
        />
        <Route
          path="fleet/new"
          element={
            <L>
              <AdminFleetNew lang="en" />
            </L>
          }
        />
        <Route
          path="audit"
          element={
            <L>
              <AdminAudit lang="en" />
            </L>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
