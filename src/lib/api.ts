/**
 * Tiny fetch wrapper for /api/* endpoints. Same-origin (CSP allows only 'self'
 * for connect-src), credentials included so the session cookie travels.
 *
 * CSRF: state-changing requests (POST / PATCH / DELETE) carry the value of
 * the `mp_csrf` cookie in an `X-CSRF-Token` header. The cookie is NOT
 * HttpOnly so this code can read it; the session cookie remains HttpOnly.
 * Server verifies header === cookie (the "double-submit" pattern). This
 * defeats classic CSRF because a foreign origin can drive the browser to
 * send the cookie, but can't read it cross-origin to put it in a header.
 */

interface ApiOpts {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  body?: unknown
  signal?: AbortSignal
  /** Set true for `multipart/form-data` calls (attachments upload). We then
   * skip the JSON content-type and let the FormData carry its own boundary. */
  formData?: FormData
}

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
    this.name = 'ApiError'
  }
}

const CSRF_COOKIE_NAME = 'mp_csrf'

function readCsrfCookie(): string | null {
  if (typeof document === 'undefined') return null
  for (const part of document.cookie.split(';')) {
    const [k, ...rest] = part.trim().split('=')
    if (k === CSRF_COOKIE_NAME) return rest.join('=')
  }
  return null
}

export async function api<T>(path: string, opts: ApiOpts = {}): Promise<T> {
  const { method = 'GET', body, signal, formData } = opts
  const headers: Record<string, string> = {}
  const init: RequestInit = {
    method,
    credentials: 'same-origin',
    signal,
  }
  if (formData) {
    init.body = formData
  } else if (body !== undefined) {
    headers['content-type'] = 'application/json'
    init.body = JSON.stringify(body)
  }
  // Attach CSRF token on state-changing methods. GET is safe by definition.
  if (method !== 'GET') {
    const token = readCsrfCookie()
    if (token) headers['x-csrf-token'] = token
  }
  if (Object.keys(headers).length > 0) init.headers = headers
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
