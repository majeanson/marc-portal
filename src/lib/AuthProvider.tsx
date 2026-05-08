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
