import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { AuthProvider } from './lib/AuthProvider'
import { TenantProvider } from './lib/TenantProvider'
import { initSentry } from './lib/sentry'
import { installScrollDirection } from './lib/scrollDirection'
import { printConsoleGreeting } from './lib/consoleGreeting'
import { router } from './router'
import './styles.css'

// Init Sentry as early as possible so a crash during React mount still
// reports. Silently no-ops when VITE_SENTRY_DSN isn't set (dev, preview
// without secrets).
initSentry()

// Track scroll direction at the root so sticky headers can hide on
// scroll-down and slide back on scroll-up. CSS reads the resulting
// data-scroll-direction attribute on <html>.
installScrollDirection()

// Quirky bilingual hello for visitors who open devtools.
printConsoleGreeting()

// `createRoot`, not `hydrateRoot`. scripts/prerender.mjs snapshots the
// homepage to static HTML for a fast first paint (FCP) — but that snapshot is
// a *post-effect* browser capture, which never byte-matches React's own first
// render. Hydrating it just produces mismatches and a full client re-render
// anyway; `createRoot` does the same render without the mismatch noise. The
// prerender stays a paint/SEO win; React then renders `#root` fresh over it.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TenantProvider>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </TenantProvider>
  </StrictMode>,
)
