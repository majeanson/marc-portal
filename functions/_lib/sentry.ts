// Tiny Sentry envelope poster for Pages Functions. No SDK dependency —
// the surface we use (capture a single exception with request context) is
// 80 lines of HTTP and a regex; the full @sentry/cloudflare SDK is more
// than that just at import time.
//
// When SENTRY_DSN is unset, every function here silently no-ops. The
// caller doesn't need to gate on `if (env.SENTRY_DSN)` — just call.
//
// DSN format: https://<KEY>@<HOST>/<PROJECT>
// Envelope endpoint: https://<HOST>/api/<PROJECT>/envelope/

interface ParsedDsn {
  host: string
  projectId: string
  publicKey: string
}

function parseDsn(dsn: string | undefined): ParsedDsn | null {
  if (!dsn) return null
  try {
    const u = new URL(dsn)
    const projectId = u.pathname.replace(/^\//, '').replace(/\/$/, '')
    if (!u.username || !u.host || !projectId) return null
    return { host: u.host, projectId, publicKey: u.username }
  } catch {
    return null
  }
}

/**
 * Report an exception to Sentry. Fire-and-forget — we don't block the
 * response on the upload, and any failure to send is swallowed (we're not
 * going to recursively report Sentry-outage-to-Sentry).
 *
 * Context is optional but recommended: `{ request, email, op }`. The
 * request is mined for URL, method, headers (sanitized — no Cookie /
 * Authorization), and trace ids.
 */
export function captureWorkerException(
  err: unknown,
  env: { SENTRY_DSN?: string },
  ctx: {
    request?: Request
    email?: string | null
    op?: string
    extra?: Record<string, unknown>
  } = {},
): void {
  const parsed = parseDsn(env.SENTRY_DSN)
  if (!parsed) return

  const now = new Date()
  const eventId = crypto.randomUUID().replace(/-/g, '')

  // Build the JS-style exception payload Sentry expects. Stack frames are
  // best-effort (a thrown non-Error has no stack); we always supply at
  // least `type` and `value` so the event groups in the UI.
  const errObj = err instanceof Error ? err : new Error(String(err))
  const event = {
    event_id: eventId,
    timestamp: now.toISOString(),
    platform: 'javascript',
    level: 'error',
    environment: inferEnvironment(ctx.request),
    server_name: 'cf-pages-function',
    transaction: ctx.op,
    exception: {
      values: [
        {
          type: errObj.name || 'Error',
          value: errObj.message || 'unknown',
          stacktrace: errObj.stack ? parseStack(errObj.stack) : undefined,
        },
      ],
    },
    request: ctx.request ? requestSummary(ctx.request) : undefined,
    user: ctx.email ? { email: ctx.email } : undefined,
    extra: ctx.extra,
  }

  // Envelope: a newline-delimited JSON blob with a header line + one item
  // header line + the event JSON. Spec is intentionally simple to make
  // edge clients like this one feasible.
  const envelope =
    JSON.stringify({ event_id: eventId, sent_at: now.toISOString() }) +
    '\n' +
    JSON.stringify({ type: 'event' }) +
    '\n' +
    JSON.stringify(event)

  const url = `https://${parsed.host}/api/${parsed.projectId}/envelope/?sentry_version=7&sentry_key=${parsed.publicKey}`

  // Fire and forget. `ctx.waitUntil` isn't available here without threading
  // through the Pages context, so we just don't await — the runtime will
  // hold the request open until the fetch resolves on the happy path; on
  // error we eat it.
  fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/x-sentry-envelope' },
    body: envelope,
  }).catch(() => {
    // Swallow — Sentry outage shouldn't take down our handler error log.
  })
}

function inferEnvironment(request?: Request): string {
  if (!request) return 'production'
  const host = new URL(request.url).host.toLowerCase()
  if (host.endsWith('.pages.dev') && /^[a-f0-9]{8}\./.test(host)) return 'preview'
  if (host === 'localhost' || host.startsWith('127.0.0.1') || host.startsWith('localhost:'))
    return 'development'
  return 'production'
}

function requestSummary(request: Request): Record<string, unknown> {
  const url = new URL(request.url)
  const headers: Record<string, string> = {}
  for (const [k, v] of request.headers.entries()) {
    const lk = k.toLowerCase()
    // Strip auth-bearing headers; never send these to a third party.
    if (lk === 'cookie' || lk === 'authorization' || lk === 'x-csrf-token') continue
    headers[k] = v
  }
  return {
    url: url.toString(),
    method: request.method,
    headers,
    query_string: url.search.replace(/^\?/, ''),
  }
}

/**
 * Convert a V8-style stack string into Sentry's expected frames format.
 * Loose parsing: each "at fn (file:line:col)" line becomes a frame. Lines
 * we can't parse are silently dropped — the event still groups by the
 * top-level exception value.
 */
function parseStack(stack: string): { frames: Array<Record<string, unknown>> } {
  const frames: Array<Record<string, unknown>> = []
  const re = /at (.+?) \((.+?):(\d+):(\d+)\)/
  for (const line of stack.split('\n')) {
    const m = re.exec(line)
    if (!m) continue
    frames.push({
      function: m[1],
      filename: m[2],
      lineno: Number.parseInt(m[3]!, 10),
      colno: Number.parseInt(m[4]!, 10),
      in_app: !m[2]!.includes('node_modules'),
    })
  }
  // Sentry expects frames newest-first → oldest-last; V8 stacks are already in
  // that order, so just reverse for the "callee at top" convention Sentry
  // renders.
  return { frames: frames.reverse() }
}
