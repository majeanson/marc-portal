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

export function tooManyRequests(message = 'rate limit exceeded'): Response {
  return json({ error: message }, { status: 429 })
}

export function serverError(message = 'internal error'): Response {
  return json({ error: message }, { status: 500 })
}
