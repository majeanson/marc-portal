// react-refresh wants a file to export only components for HMR. This file
// exports the router object alongside internal helper components — that's
// the standard react-router setup pattern, and HMR isn't useful for the
// router config anyway (it'd recreate the router and lose route state).
/* eslint-disable react-refresh/only-export-components */
import { Suspense, lazy, useEffect, type ReactNode } from 'react'
import {
  Navigate,
  Outlet,
  Route,
  createBrowserRouter,
  createRoutesFromElements,
  useLocation,
} from 'react-router-dom'
import { trackVisit } from './lib/visitTracker'

// Hot-path pages — keep eager so the home/intake/login critical path stays
// fast and FCP-friendly.
import { Home } from './pages/Home'
import { Intake } from './pages/Intake'
import { Login } from './pages/Login'
import { MagicLinkSent } from './pages/MagicLinkSent'
import { NotFound } from './pages/NotFound'
import { RouteError } from './pages/RouteError'

// Cold-path pages — lazy. Cuts the initial bundle (demos, all admin
// surfaces, the auth-gated dashboard + session views) at the cost of one
// network round-trip when first visited. MePortal and SessionPage are only
// reached after sign-in, so they stay off the home/intake/login path.
const MePortal = lazy(() => import('./pages/MePortal').then((m) => ({ default: m.MePortal })))
const SessionPage = lazy(() =>
  import('./pages/SessionPage').then((m) => ({ default: m.SessionPage })),
)
const Engagement = lazy(() => import('./pages/Engagement').then((m) => ({ default: m.Engagement })))
const Tier0 = lazy(() => import('./pages/Tier0').then((m) => ({ default: m.Tier0 })))
const Privacy = lazy(() => import('./pages/Privacy').then((m) => ({ default: m.Privacy })))
const Pia = lazy(() => import('./pages/Pia').then((m) => ({ default: m.Pia })))
const Handoff = lazy(() => import('./pages/Handoff').then((m) => ({ default: m.Handoff })))
const HandoffChecklist = lazy(() =>
  import('./pages/HandoffChecklist').then((m) => ({ default: m.HandoffChecklist })),
)
const AdminInbox = lazy(() => import('./pages/AdminInbox').then((m) => ({ default: m.AdminInbox })))
const AdminTrash = lazy(() => import('./pages/AdminTrash').then((m) => ({ default: m.AdminTrash })))
const AdminCustodians = lazy(() =>
  import('./pages/AdminCustodians').then((m) => ({ default: m.AdminCustodians })),
)
const Meta = lazy(() => import('./pages/Meta').then((m) => ({ default: m.Meta })))
const Atelier = lazy(() => import('./pages/Atelier').then((m) => ({ default: m.Atelier })))
// Aliased to MapPage at import to avoid shadowing the global Map constructor.
const MapPage = lazy(() => import('./pages/Map').then((m) => ({ default: m.Map })))
const Admin = lazy(() => import('./pages/Admin').then((m) => ({ default: m.Admin })))
const AdminAudit = lazy(() => import('./pages/AdminAudit').then((m) => ({ default: m.AdminAudit })))
const AdminEmailOutbox = lazy(() =>
  import('./pages/AdminEmailOutbox').then((m) => ({ default: m.AdminEmailOutbox })),
)
const AdminShowcase = lazy(() =>
  import('./pages/AdminShowcase').then((m) => ({ default: m.AdminShowcase })),
)
const AdminHub = lazy(() => import('./pages/AdminHub').then((m) => ({ default: m.AdminHub })))
const AdminRunbook = lazy(() =>
  import('./pages/AdminRunbook').then((m) => ({ default: m.AdminRunbook })),
)
const AdminToday = lazy(() => import('./pages/AdminToday').then((m) => ({ default: m.AdminToday })))
const PublicAdvancements = lazy(() =>
  import('./pages/PublicAdvancements').then((m) => ({ default: m.PublicAdvancements })),
)
const Projects = lazy(() => import('./pages/Projects').then((m) => ({ default: m.Projects })))
const Journey = lazy(() => import('./pages/Journey').then((m) => ({ default: m.Journey })))
const Vouches = lazy(() => import('./pages/Vouches').then((m) => ({ default: m.Vouches })))
const Vouch = lazy(() => import('./pages/Vouch').then((m) => ({ default: m.Vouch })))
const MyData = lazy(() => import('./pages/MyData').then((m) => ({ default: m.MyData })))
const AdminVouches = lazy(() =>
  import('./pages/AdminVouches').then((m) => ({ default: m.AdminVouches })),
)
const Passage = lazy(() => import('./pages/Passage').then((m) => ({ default: m.Passage })))
const Dossier = lazy(() => import('./pages/Dossier').then((m) => ({ default: m.Dossier })))
const AuRevoir = lazy(() => import('./pages/AuRevoir').then((m) => ({ default: m.AuRevoir })))

// Minimal skeleton shown while a lazy() chunk is in flight. Visually quiet,
// avoids the "is this broken?" feel of an empty aria-busy main. Header is
// not rendered (it depends on auth context that's mid-load on first paint);
// the rail + a couple of soft bars give the page enough shape to read as
// "loading" instead of "broken."
function RouteFallback() {
  return (
    <main className="page route-fallback" aria-busy="true" aria-label="Loading">
      <div className="route-fallback__bar" />
      <div className="route-fallback__bar route-fallback__bar--narrow" />
      <div className="route-fallback__bar route-fallback__bar--wide" />
    </main>
  )
}

function L({ children }: { children: ReactNode }) {
  return <Suspense fallback={<RouteFallback />}>{children}</Suspense>
}

// Root layout — hosts the lazy <Outlet/> under a single Suspense boundary.
// Providers live above the <RouterProvider> (see main.tsx) so useAuth /
// useTenant work in every route component.
//
// Also the single hook into the visit tracker: every SPA navigation lands
// here, so logging the pathname here is enough to drive the /passage
// receipt without a per-page useEffect. Hash-only and search-only changes
// reuse the same path key, which is the right semantics (a receipt of
// "pages walked through", not "URLs typed").
function RootLayout() {
  const loc = useLocation()
  useEffect(() => {
    trackVisit(loc.pathname)
  }, [loc.pathname])
  return (
    <Suspense fallback={<RouteFallback />}>
      <Outlet />
    </Suspense>
  )
}

export const router = createBrowserRouter(
  createRoutesFromElements(
    <Route element={<RootLayout />} errorElement={<RouteError />}>
      <Route path="/" element={<Home lang="fr" />} />
      <Route path="/en" element={<Home lang="en" />} />
      <Route path="/intake" element={<Intake lang="fr" />} />
      <Route path="/en/intake" element={<Intake lang="en" />} />
      {/* /napkin folded into the intake form (the sketch is now an inline
          step inside /intake). The old route stays as a redirect so existing
          links, the home teaser and indexed URLs don't 404. */}
      <Route path="/napkin" element={<Navigate to="/intake" replace />} />
      <Route path="/en/napkin" element={<Navigate to="/en/intake" replace />} />
      <Route
        path="/tier-0"
        element={
          <L>
            <Tier0 lang="fr" />
          </L>
        }
      />
      <Route
        path="/parcours"
        element={
          <L>
            <Journey lang="fr" />
          </L>
        }
      />
      <Route
        path="/en/journey"
        element={
          <L>
            <Journey lang="en" />
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
        path="/pia"
        element={
          <L>
            <Pia lang="fr" />
          </L>
        }
      />
      <Route
        path="/en/pia"
        element={
          <L>
            <Pia lang="en" />
          </L>
        }
      />
      <Route
        path="/handoff"
        element={
          <L>
            <Handoff lang="fr" />
          </L>
        }
      />
      <Route
        path="/en/handoff"
        element={
          <L>
            <Handoff lang="en" />
          </L>
        }
      />
      <Route
        path="/handoff/checklist"
        element={
          <L>
            <HandoffChecklist lang="fr" />
          </L>
        }
      />
      <Route
        path="/en/handoff/checklist"
        element={
          <L>
            <HandoffChecklist lang="en" />
          </L>
        }
      />
      <Route
        path="/meta"
        element={
          <L>
            <Meta lang="fr" />
          </L>
        }
      />
      <Route
        path="/en/meta"
        element={
          <L>
            <Meta lang="en" />
          </L>
        }
      />
      <Route
        path="/atelier"
        element={
          <L>
            <Atelier lang="fr" />
          </L>
        }
      />
      <Route
        path="/en/atelier"
        element={
          <L>
            <Atelier lang="en" />
          </L>
        }
      />
      <Route
        path="/carte"
        element={
          <L>
            <MapPage lang="fr" />
          </L>
        }
      />
      <Route
        path="/en/map"
        element={
          <L>
            <MapPage lang="en" />
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
      <Route
        path="/me/data"
        element={
          <L>
            <MyData lang="fr" />
          </L>
        }
      />
      <Route
        path="/en/me/data"
        element={
          <L>
            <MyData lang="en" />
          </L>
        }
      />
      <Route
        path="/me/dossier"
        element={
          <L>
            <Dossier lang="fr" />
          </L>
        }
      />
      <Route
        path="/en/me/dossier"
        element={
          <L>
            <Dossier lang="en" />
          </L>
        }
      />
      <Route
        path="/passage"
        element={
          <L>
            <Passage lang="fr" />
          </L>
        }
      />
      <Route
        path="/en/passage"
        element={
          <L>
            <Passage lang="en" />
          </L>
        }
      />
      <Route
        path="/au-revoir"
        element={
          <L>
            <AuRevoir lang="fr" />
          </L>
        }
      />
      <Route
        path="/en/goodbye"
        element={
          <L>
            <AuRevoir lang="en" />
          </L>
        }
      />
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
        path="/vouches"
        element={
          <L>
            <Vouches lang="fr" />
          </L>
        }
      />
      <Route
        path="/en/vouches"
        element={
          <L>
            <Vouches lang="en" />
          </L>
        }
      />
      <Route
        path="/vouch"
        element={
          <L>
            <Vouch lang="fr" />
          </L>
        }
      />
      <Route
        path="/en/vouch"
        element={
          <L>
            <Vouch lang="en" />
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
      <Route
        path="/admin/custodians"
        element={
          <L>
            <AdminCustodians lang="fr" />
          </L>
        }
      />
      <Route
        path="/en/admin/custodians"
        element={
          <L>
            <AdminCustodians lang="en" />
          </L>
        }
      />
      <Route
        path="/admin/vouches"
        element={
          <L>
            <AdminVouches lang="fr" />
          </L>
        }
      />
      <Route
        path="/en/admin/vouches"
        element={
          <L>
            <AdminVouches lang="en" />
          </L>
        }
      />
      <Route path="/admin/inbox/:id" element={<SessionPage lang="fr" />} />
      <Route path="/en/admin/inbox/:id" element={<SessionPage lang="en" />} />

      {/* Admin shell.
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
        <Route
          index
          element={
            <L>
              <AdminHub lang="fr" />
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
        <Route
          path="showcase"
          element={
            <L>
              <AdminShowcase lang="fr" />
            </L>
          }
        />
        <Route
          path="runbook"
          element={
            <L>
              <AdminRunbook lang="fr" />
            </L>
          }
        />
        <Route
          path="today"
          element={
            <L>
              <AdminToday lang="fr" />
            </L>
          }
        />
        <Route
          path="email-outbox"
          element={
            <L>
              <AdminEmailOutbox lang="fr" />
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
        <Route
          index
          element={
            <L>
              <AdminHub lang="en" />
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
        <Route
          path="showcase"
          element={
            <L>
              <AdminShowcase lang="en" />
            </L>
          }
        />
        <Route
          path="runbook"
          element={
            <L>
              <AdminRunbook lang="en" />
            </L>
          }
        />
        <Route
          path="today"
          element={
            <L>
              <AdminToday lang="en" />
            </L>
          }
        />
        <Route
          path="email-outbox"
          element={
            <L>
              <AdminEmailOutbox lang="en" />
            </L>
          }
        />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Route>,
  ),
)
