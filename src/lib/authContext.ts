import { createContext, useContext } from 'react'

export interface AuthState {
  email: string | null
  /** Effective admin flag — false when previewAsUser is on. */
  isAdmin: boolean
  /** Server-truth admin flag, ignoring preview toggle. */
  realIsAdmin: boolean
  /** When true, isAdmin is forced to false so the chrome reflects a non-admin view. */
  previewAsUser: boolean
  /** Toggle the preview override. Persists to sessionStorage. */
  setPreviewAsUser: (v: boolean) => void
  loading: boolean
  /** POST /api/auth/request-link. Returns true if the request was accepted. */
  requestLink: (email: string, lang: 'fr' | 'en') => Promise<boolean>
  logout: () => Promise<void>
  refresh: () => Promise<void>
}

export const AuthContext = createContext<AuthState | null>(null)

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
