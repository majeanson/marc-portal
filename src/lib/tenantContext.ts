import { createContext, useContext } from 'react'

/** Mirrors the TenantPublic shape returned by GET /api/tenant. */
export interface TenantPublic {
  id: string
  slug: string
  templateId: string
  templateVersion: string
  displayName: string
  footer: string
  logoUrl: string | null
  /** Map of theme-token-name → CSS value. Empty when using defaults. */
  theme: Record<string, string>
  maintenance: boolean
}

export interface TenantState {
  tenant: TenantPublic | null
  loading: boolean
  /** True until /api/tenant resolves; consumers should generally render anyway. */
  refresh: () => Promise<void>
}

export const TenantContext = createContext<TenantState | null>(null)

/**
 * Read the current tenant. Safe to call before resolution finishes — returns
 * `tenant: null, loading: true`. Most consumers should treat null as "use the
 * built-in defaults" and render normally; only operator/buyer admin surfaces
 * actually require a tenant to function.
 */
export function useTenant(): TenantState {
  const ctx = useContext(TenantContext)
  if (!ctx) throw new Error('useTenant must be used inside TenantProvider')
  return ctx
}
