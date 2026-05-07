/**
 * Tiny fetch wrapper for /api/* endpoints. Same-origin (CSP allows only 'self'
 * for connect-src), credentials included so the session cookie travels.
 */

interface ApiOpts {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  body?: unknown
  signal?: AbortSignal
}

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
    this.name = 'ApiError'
  }
}

export async function api<T>(path: string, opts: ApiOpts = {}): Promise<T> {
  const { method = 'GET', body, signal } = opts
  const init: RequestInit = {
    method,
    credentials: 'same-origin',
    signal,
  }
  if (body !== undefined) {
    init.headers = { 'content-type': 'application/json' }
    init.body = JSON.stringify(body)
  }
  const res = await fetch(path, init)
  let data: unknown = null
  try {
    data = await res.json()
  } catch {
    // empty/non-JSON body
  }
  if (!res.ok) {
    const message =
      data && typeof data === 'object' && 'error' in data && typeof data.error === 'string'
        ? data.error
        : `request failed: ${res.status}`
    throw new ApiError(res.status, message)
  }
  return data as T
}
