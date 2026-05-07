import { createContext, useContext } from 'react'

export interface AuthState {
  email: string | null
  isAdmin: boolean
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
