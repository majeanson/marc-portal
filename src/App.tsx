import { Routes, Route, Navigate } from 'react-router-dom'
import { Home } from './pages/Home'
import { Showcase } from './pages/Showcase'
import { Intake } from './pages/Intake'
import { SndDemo } from './pages/SndDemo'
import { Engagement } from './pages/Engagement'
import { Tier0 } from './pages/Tier0'

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
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
