import { createContext, useContext } from 'react'

/** Mirrors functions/_lib/emailSuppression.ts's SuppressionReason. Kept as a
 *  separate literal union here (not imported) since the client bundle has no
 *  path to the Functions source — this is the one place the shape needs to
 *  stay hand-synced if the server's reasons ever change. */
export type MagicLinkSuppressionReason = 'complaint' | 'unsubscribed' | 'hard-bounce'

export interface RequestLinkResult {
  /** True once the request reached the server — the server itself always
   *  200s (anti-enumeration), so `false` here means the fetch never landed
   *  (offline, DNS, server down), not "no such account". */
  sent: boolean
  /** Present when /api/auth/request-link reports the address is on the
   *  send-suppression list (prior hard bounce, complaint, or unsubscribe).
   *  Deliverability only — never leaks whether an account exists, and only
   *  ever reaches the person who typed this exact address. */
  suppressed?: MagicLinkSuppressionReason
}

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
  /** POST /api/auth/request-link. */
  requestLink: (email: string, lang: 'fr' | 'en') => Promise<RequestLinkResult>
  logout: () => Promise<void>
  refresh: () => Promise<void>
}

export const AuthContext = createContext<AuthState | null>(null)

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
