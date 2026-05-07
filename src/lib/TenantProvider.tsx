/**
 * Tenant provider. Bootstraps from /api/tenant on mount; applies the tenant's
 * theme tokens as CSS custom properties on the document root; sets the
 * document title from the displayName. No theme = use the styles.css :root
 * defaults (Bonjour palette).
 *
 * In dev with vanilla `vite` (no wrangler), /api/tenant is unreachable; the
 * provider degrades to `tenant: null` and the UI renders with defaults.
 */

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api } from './api'
import { TenantContext, type TenantPublic, type TenantState } from './tenantContext'

/**
 * Mapping of TenantPublic.theme keys → CSS custom-property names.
 * Mirror of `themeToCssVars` in functions/_lib/tenant.ts. Kept in sync by hand;
 * a divergence at most leaks the default value (visual regression, not a bug).
 */
const THEME_KEY_TO_CSS_VAR: Record<string, string> = {
  accent: '--accent',
  accentDeep: '--accent-warm',
  accentSoft: '--accent-soft',
  paper: '--bg',
  paperWarm: '--bg-card',
  paperSoft: '--bg-section',
  paperDeep: '--bg-hover',
  ink: '--text',
  inkSoft: '--text-mid',
  warm: '--warm',
  cool: '--cool',
  display: '--display',
  sans: '--sans',
  radius: '--radius',
}

function applyTheme(theme: Record<string, string>) {
  const root = document.documentElement
  for (const [key, cssVar] of Object.entries(THEME_KEY_TO_CSS_VAR)) {
    const value = theme[key]
    if (typeof value === 'string' && value.length > 0) {
      root.style.setProperty(cssVar, value)
    } else {
      // Tenant cleared this token — fall back to the styles.css default.
      root.style.removeProperty(cssVar)
    }
  }
}

export function TenantProvider({ children }: { children: ReactNode }) {
  const [tenant, setTenant] = useState<TenantPublic | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const t = await api<TenantPublic>('/api/tenant')
      setTenant(t)
      applyTheme(t.theme)
      // Set the document title from the tenant's display name when none is
      // already set by a route. Routes are free to override later.
      if (document.title === '' || document.title === 'Vite + React + TS') {
        document.title = t.displayName
      }
    } catch {
      // Dev without wrangler, or unknown host. Use defaults.
      setTenant(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    api<TenantPublic>('/api/tenant')
      .then((t) => {
        if (cancelled) return
        setTenant(t)
        applyTheme(t.theme)
        if (document.title === '' || document.title === 'Vite + React + TS') {
          document.title = t.displayName
        }
      })
      .catch(() => {
        if (cancelled) return
        setTenant(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const value = useMemo<TenantState>(() => ({ tenant, loading, refresh }), [tenant, loading, refresh])

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>
}
