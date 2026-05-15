// react-refresh wants a file to export only components for HMR. This file
// exports the router object alongside internal helper components — that's
// the standard react-router setup pattern, and HMR isn't useful for the
// router config anyway (it'd recreate the router and lose route state).
/* eslint-disable react-refresh/only-export-components */
import { Suspense, lazy, type ReactNode } from 'react'
import {
  Navigate,
  Outlet,
  Route,
  createBrowserRouter,
  createRoutesFromElements,
} from 'react-router-dom'

// Hot-path pages — keep eager so the home/intake/login critical path stays
// fast and FCP-friendly.
import { RootByTemplate } from './pages/RootByTemplate'
import { Intake } from './pages/Intake'
import { Login } from './pages/Login'
import { MagicLinkSent } from './pages/MagicLinkSent'
import { MePortal } from './pages/MePortal'
import { SessionPage } from './pages/SessionPage'

// Cold-path pages — lazy. Cuts the initial bundle (demos, all admin
// surfaces) at the cost of one network round-trip when first visited.
const SndDemo = lazy(() => import('./pages/SndDemo').then((m) => ({ default: m.SndDemo })))
const Engagement = lazy(() => import('./pages/Engagement').then((m) => ({ default: m.Engagement })))
const Tier0 = lazy(() => import('./pages/Tier0').then((m) => ({ default: m.Tier0 })))
const Privacy = lazy(() => import('./pages/Privacy').then((m) => ({ default: m.Privacy })))
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
const PublicAdvancements = lazy(() =>
  import('./pages/PublicAdvancements').then((m) => ({ default: m.PublicAdvancements })),
)
const Projects = lazy(() => import('./pages/Projects').then((m) => ({ default: m.Projects })))
const Napkin = lazy(() => import('./pages/Napkin').then((m) => ({ default: m.Napkin })))

function L({ children }: { children: ReactNode }) {
  return <Suspense fallback={<main className="page" aria-busy="true" />}>{children}</Suspense>
}

// Root layout — hosts the lazy <Outlet/> under a single Suspense boundary.
// Providers live above the <RouterProvider> (see main.tsx) so useAuth /
// useTenant work in every route component.
function RootLayout() {
  return (
    <Suspense fallback={<main className="page" aria-busy="true" />}>
      <Outlet />
    </Suspense>
  )
}

export const router = createBrowserRouter(
  createRoutesFromElements(
    <Route element={<RootLayout />}>
      <Route path="/" element={<RootByTemplate lang="fr" />} />
      <Route path="/en" element={<RootByTemplate lang="en" />} />
      <Route path="/intake" element={<Intake lang="fr" />} />
      <Route path="/en/intake" element={<Intake lang="en" />} />
      <Route
        path="/napkin"
        element={
          <L>
            <Napkin lang="fr" />
          </L>
        }
      />
      <Route
        path="/en/napkin"
        element={
          <L>
            <Napkin lang="en" />
          </L>
        }
      />
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
        path="/confidentialite"
        element={
          <L>
            <Privacy lang="fr" />
          </L>
        }
      />
      <Route
        path="/en/privacy"
        element={
          <L>
            <Privacy lang="en" />
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

      <Route path="/login" element={<Login lang="fr" />} />
      <Route path="/en/login" element={<Login lang="en" />} />
      <Route path="/login/sent" element={<MagicLinkSent lang="fr" />} />
      <Route path="/en/login/sent" element={<MagicLinkSent lang="en" />} />
      <Route path="/me" element={<MePortal lang="fr" />} />
      <Route path="/en/me" element={<MePortal lang="en" />} />
      <Route path="/session/:id" element={<SessionPage lang="fr" />} />
      <Route path="/en/session/:id" element={<SessionPage lang="en" />} />
      <Route
        path="/share/:id"
        element={
          <L>
            <PublicAdvancements lang="fr" />
          </L>
        }
      />
      <Route
        path="/en/share/:id"
        element={
          <L>
            <PublicAdvancements lang="en" />
          </L>
        }
      />
      <Route
        path="/projects"
        element={
          <L>
            <Projects lang="fr" />
          </L>
        }
      />
      <Route
        path="/en/projects"
        element={
          <L>
            <Projects lang="en" />
          </L>
        }
      />
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

      {/* Admin shell — fleet feat-2026-016.
          Deliberate duplication: the FR + EN subtrees are mirrored explicitly
          rather than collapsed under <Route path="/:lang?/admin"> because the
          per-page components currently receive `lang` as a prop. */}
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
    </Route>,
  ),
)
