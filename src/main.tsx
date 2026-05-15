import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { AuthProvider } from './lib/AuthProvider'
import { TenantProvider } from './lib/TenantProvider'
import { initSentry } from './lib/sentry'
import { router } from './router'
import './styles.css'

// Init Sentry as early as possible so a crash during React mount still
// reports. Silently no-ops when VITE_SENTRY_DSN isn't set (dev, preview
// without secrets).
initSentry()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TenantProvider>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </TenantProvider>
  </StrictMode>,
)
