// feat-custom-domain-onboarding
// Thin wrapper for the Cloudflare Pages REST API. Used by /api/admin/fleet
// to auto-attach a buyer's custom domain to this Pages project when a tenant
// is provisioned. CF then handles SSL provisioning automatically once the
// buyer points their DNS at the project's CNAME target.
//
// All three env vars must be set for the API call to fire:
//   CF_API_TOKEN          — token with "Cloudflare Pages: Edit" permission
//   CF_ACCOUNT_ID         — the account that owns this Pages project
//   CF_PAGES_PROJECT_NAME — e.g. "marc-portal" (visible in the dashboard URL)
// Missing any one → returns { skipped: true } and the caller falls back to
// the manual-instructions UX. No throws on missing config.

import type { Env } from './env'

const CF_API_BASE = 'https://api.cloudflare.com/client/v4'

export interface AttachDomainResult {
  ok: boolean
  /** True when env vars are missing — caller should surface manual-fallback UX. */
  skipped?: boolean
  /** Human-readable error message when ok=false. */
  error?: string
  /** When ok=true, the CNAME target the buyer must point DNS at. */
  cname?: string
  /** When ok=true, current SSL status from CF (usually 'initializing' on first attach). */
  status?: string
}

/**
 * Attach a custom domain to the configured Pages project. Idempotent on the
 * CF side — re-attaching an existing domain returns the same record (we
 * report it as ok in that case).
 */
export async function attachCustomDomain(
  env: Env,
  domain: string,
): Promise<AttachDomainResult> {
  const config = readConfig(env)
  if (!config) return { ok: true, skipped: true }

  const url = `${CF_API_BASE}/accounts/${config.accountId}/pages/projects/${config.projectName}/domains`

  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ name: domain }),
    })
  } catch (err) {
    return { ok: false, error: `network: ${err instanceof Error ? err.message : 'unknown'}` }
  }

  // CF returns 200 on success; non-2xx with a JSON error envelope on failure.
  let body: unknown = null
  try {
    body = await res.json()
  } catch {
    // empty/non-JSON body — fall through with a generic error
  }

  if (res.ok) {
    const result = (body as { result?: { name?: string; status?: string } } | null)?.result
    return {
      ok: true,
      cname: result?.name,
      status: result?.status,
    }
  }

  // Already attached → CF returns 409 + an error code 8000005 ("Domain
  // already exists"). Treat as success so re-runs of the wizard are safe.
  const errors = (body as { errors?: Array<{ code?: number; message?: string }> } | null)?.errors
  if (errors?.some((e) => e.code === 8000005)) {
    return { ok: true, status: 'existing' }
  }

  const message = errors?.[0]?.message ?? `cf api ${res.status}`
  return { ok: false, error: message }
}

interface CfConfig {
  token: string
  accountId: string
  projectName: string
}

function readConfig(env: Env): CfConfig | null {
  const token = env.CF_API_TOKEN?.trim()
  const accountId = env.CF_ACCOUNT_ID?.trim()
  const projectName = env.CF_PAGES_PROJECT_NAME?.trim()
  if (!token || !accountId || !projectName) return null
  return { token, accountId, projectName }
}
