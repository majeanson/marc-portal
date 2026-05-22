import { StrictMode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
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

const container = document.getElementById('root')!

const tree = (
  <StrictMode>
    <TenantProvider>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </TenantProvider>
  </StrictMode>
)

// Hydrate vs. fresh render — this is what makes the prerendered HTML a
// *performance* win and not just an SEO one.
//
// scripts/prerender.mjs snapshots two routes — `/` and `/en` — into the
// served HTML. When the visitor lands on one of those, `#root` already holds
// the fully-painted page: `hydrateRoot` ADOPTS that DOM in place, so the hero
// the browser already painted IS the LCP element — no destroy-and-rebuild, no
// second paint, LCP collapses onto FCP.
//
// Every other route is served that same prerendered `/` HTML (the
// `/* /index.html 200` SPA fallback in public/_redirects). There the
// prerendered DOM is the *wrong* page, so hydration would only mismatch —
// `createRoot` correctly discards it and renders the real route fresh.
const path = window.location.pathname
const isPrerenderedRoute = path === '/' || path === '/en' || path === '/en/'

if (isPrerenderedRoute && container.firstElementChild) {
  hydrateRoot(container, tree)
} else {
  createRoot(container).render(tree)
}
