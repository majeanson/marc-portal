/**
 * Auth provider. Bootstraps from /api/me on mount; exposes the current email,
 * isAdmin, requestLink (magic link), logout. No external state lib —
 * useState + a tiny context, per the boring-tech mandate.
 *
 * Also owns the "view as user" preview toggle: an admin can flip a
 * sessionStorage flag that forces `isAdmin` to false in the UI without
 * touching the session cookie. Server-side authority is unchanged; this is
 * a chrome-only override to QA the visitor experience while signed in.
 */

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api } from './api'
import { AuthContext, type AuthState } from './authContext'
import { clearDraft } from './draft'
import { setSentryUser } from './sentry'

interface MeResponse {
  email: string | null
  isAdmin: boolean
}

const PREVIEW_AS_USER_KEY = 'preview-as-user'

function readPreviewFlag(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.sessionStorage.getItem(PREVIEW_AS_USER_KEY) === '1'
  } catch {
    return false
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [email, setEmail] = useState<string | null>(null)
  const [realIsAdmin, setRealIsAdmin] = useState(false)
  const [previewAsUser, setPreviewAsUserState] = useState<boolean>(() => readPreviewFlag())
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const me = await api<MeResponse>('/api/me')
      setEmail(me.email)
      setRealIsAdmin(me.isAdmin)
    } catch {
      setEmail(null)
      setRealIsAdmin(false)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    api<MeResponse>('/api/me')
      .then((me) => {
        if (cancelled) return
        setEmail(me.email)
        setRealIsAdmin(me.isAdmin)
      })
      .catch(() => {
        if (cancelled) return
        setEmail(null)
        setRealIsAdmin(false)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Keep Sentry's user context in sync with the signed-in identity. Loi 25
  // posture: only the operator's email is attached (his own data going to
  // his own Sentry org). Regular visitors stay anonymous in Sentry — their
  // session/share IDs in the URL are stripped by beforeSend so events
  // can't be tied back to a specific Quebec resident. See docs/loi-25-pia.md.
  useEffect(() => {
    setSentryUser({ email, isAdmin: realIsAdmin })
  }, [email, realIsAdmin])

  const setPreviewAsUser = useCallback((v: boolean) => {
    setPreviewAsUserState(v)
    try {
      if (v) window.sessionStorage.setItem(PREVIEW_AS_USER_KEY, '1')
      else window.sessionStorage.removeItem(PREVIEW_AS_USER_KEY)
    } catch {
      // Private mode / storage disabled — preview still works in-memory.
    }
  }, [])

  const requestLink = useCallback(async (addr: string, lang: 'fr' | 'en') => {
    try {
      await api<{ sent: boolean }>('/api/auth/request-link', {
        method: 'POST',
        body: { email: addr, lang },
      })
      return true
    } catch {
      return false
    }
  }, [])

  const logout = useCallback(async () => {
    try {
      await api('/api/auth/logout', { method: 'POST' })
    } finally {
      setEmail(null)
      setRealIsAdmin(false)
      // Drop any pending-intake stash so it doesn't follow the user across
      // accounts on a shared device. Drafts in progress (intake-draft) stay
      // — those are device-local and unauthenticated by design.
      clearDraft('pending-intake')
    }
  }, [])

  // Effective admin: false when the operator is previewing the visitor view.
  const isAdmin = realIsAdmin && !previewAsUser
  const value = useMemo<AuthState>(
    () => ({
      email,
      isAdmin,
      realIsAdmin,
      previewAsUser,
      setPreviewAsUser,
      loading,
      requestLink,
      logout,
      refresh,
    }),
    [
      email,
      isAdmin,
      realIsAdmin,
      previewAsUser,
      setPreviewAsUser,
      loading,
      requestLink,
      logout,
      refresh,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
