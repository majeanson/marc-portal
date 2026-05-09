// Tiny response helpers. Pages Functions return Response objects; these keep
// JSON encoding + status codes terse at call sites.

export function json(data: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...(init?.headers ?? {}),
    },
  })
}

export function ok<T>(data: T): Response {
  return json(data, { status: 200 })
}

export function badRequest(message: string): Response {
  return json({ error: message }, { status: 400 })
}

export function unauthorized(message = 'unauthorized'): Response {
  return json({ error: message }, { status: 401 })
}

export function forbidden(message = 'forbidden'): Response {
  return json({ error: message }, { status: 403 })
}

export function notFound(message = 'not found'): Response {
  return json({ error: message }, { status: 404 })
}

export function conflict(message = 'conflict'): Response {
  return json({ error: message }, { status: 409 })
}

export function payloadTooLarge(message = 'payload too large'): Response {
  return json({ error: message }, { status: 413 })
}

export function unsupportedMediaType(message = 'unsupported media type'): Response {
  return json({ error: message }, { status: 415 })
}

export function serviceUnavailable(message = 'service unavailable'): Response {
  return json({ error: message }, { status: 503 })
}

export function tooManyRequests(message = 'rate limit exceeded'): Response {
  return json({ error: message }, { status: 429 })
}

export function serverError(message = 'internal error'): Response {
  return json({ error: message }, { status: 500 })
}
