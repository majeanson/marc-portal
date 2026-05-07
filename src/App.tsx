import { Routes, Route, Navigate } from 'react-router-dom'
import { Home } from './pages/Home'
import { Showcase } from './pages/Showcase'
import { Intake } from './pages/Intake'
import { SndDemo } from './pages/SndDemo'
import { Engagement } from './pages/Engagement'
import { Tier0 } from './pages/Tier0'
import { Login } from './pages/Login'
import { MagicLinkSent } from './pages/MagicLinkSent'
import { MePortal } from './pages/MePortal'
import { SessionPage } from './pages/SessionPage'
import { AdminInbox } from './pages/AdminInbox'
import { Admin } from './pages/Admin'
import { AdminAppearance } from './pages/AdminAppearance'

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Home lang="fr" />} />
      <Route path="/en" element={<Home lang="en" />} />
      <Route path="/intake" element={<Intake lang="fr" />} />
      <Route path="/en/intake" element={<Intake lang="en" />} />
      <Route path="/tier-0" element={<Tier0 lang="fr" />} />
      <Route path="/en/tier-0" element={<Tier0 lang="en" />} />
      <Route path="/demo/sunday-night-dread" element={<SndDemo lang="fr" />} />
      <Route path="/en/demo/sunday-night-dread" element={<SndDemo lang="en" />} />
      <Route path="/showcase/:slug" element={<Showcase lang="fr" />} />
      <Route path="/en/showcase/:slug" element={<Showcase lang="en" />} />
      <Route path="/engagement/:slug" element={<Engagement lang="fr" />} />
      <Route path="/en/engagement/:slug" element={<Engagement lang="en" />} />

      {/* Engagement runtime — feat-2026-015 */}
      <Route path="/login" element={<Login lang="fr" />} />
      <Route path="/en/login" element={<Login lang="en" />} />
      <Route path="/login/sent" element={<MagicLinkSent lang="fr" />} />
      <Route path="/en/login/sent" element={<MagicLinkSent lang="en" />} />
      <Route path="/me" element={<MePortal lang="fr" />} />
      <Route path="/en/me" element={<MePortal lang="en" />} />
      <Route path="/session/:id" element={<SessionPage lang="fr" />} />
      <Route path="/en/session/:id" element={<SessionPage lang="en" />} />
      <Route path="/admin/inbox" element={<AdminInbox lang="fr" />} />
      <Route path="/en/admin/inbox" element={<AdminInbox lang="en" />} />
      <Route path="/admin/inbox/:id" element={<SessionPage lang="fr" />} />
      <Route path="/en/admin/inbox/:id" element={<SessionPage lang="en" />} />

      {/* Admin shell — fleet feat-2026-016. Per-tenant settings + (operator only) fleet view. */}
      <Route path="/admin" element={<Admin lang="fr" />}>
        <Route index element={<Navigate to="/admin/apparence" replace />} />
        <Route path="apparence" element={<AdminAppearance lang="fr" />} />
      </Route>
      <Route path="/en/admin" element={<Admin lang="en" />}>
        <Route index element={<Navigate to="/en/admin/apparence" replace />} />
        <Route path="apparence" element={<AdminAppearance lang="en" />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
