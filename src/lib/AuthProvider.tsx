/**
 * Auth provider. Bootstraps from /api/me on mount; exposes the current email,
 * isAdmin, requestLink (magic link), logout. No external state lib —
 * useState + a tiny context, per the boring-tech mandate.
 */

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api } from './api'
import { AuthContext, type AuthState } from './authContext'

interface MeResponse {
  email: string | null
  isAdmin: boolean
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [email, setEmail] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const me = await api<MeResponse>('/api/me')
      setEmail(me.email)
      setIsAdmin(me.isAdmin)
    } catch {
      setEmail(null)
      setIsAdmin(false)
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
        setIsAdmin(me.isAdmin)
      })
      .catch(() => {
        if (cancelled) return
        setEmail(null)
        setIsAdmin(false)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
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
      setIsAdmin(false)
    }
  }, [])

  const value = useMemo<AuthState>(
    () => ({ email, isAdmin, loading, requestLink, logout, refresh }),
    [email, isAdmin, loading, requestLink, logout, refresh],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
