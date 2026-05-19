// feat-platform-spine
// Shared template-handler primitives. Every per-template API handler opens
// with the same auth + tenant + template-gate boilerplate; this module is
// the one place that pattern lives.
//
// Usage in a handler:
//
//   export const onRequestPost: PagesFunction<Env> = async (ctx) => {
//     const gate = await requireTemplate(ctx, 'volunteer-roster', { ownerOnly: true })
//     if (gate instanceof Response) return gate
//     const { tenant, email } = gate
//     // domain logic here
//   }

import { currentEmail } from './auth'
import type { Env } from './env'
import { isAdmin } from './env'
import { forbidden, notFound, unauthorized } from './json'
import { requireTenant, type Tenant } from './tenant'

export interface TemplateGateResult {
  tenant: Tenant
  email: string
  /** True when the signed-in user owns this tenant or is an operator on it. */
  isOwner: boolean
}

export interface TemplateGateOptions {
  /** When true, non-owners are rejected with 403. Default: false. */
  ownerOnly?: boolean
}

/**
 * Compose the four checks every template handler does in the same order:
 *   1. Tenant resolved by middleware (else 500 — programmer error)
 *   2. Tenant's templateId matches the expected one (else 404 — wrong app)
 *   3. Caller is signed in (else 401)
 *   4. (Optional) Caller is the owner OR an operator on this tenant (else 403)
 *
 * Returns either a TemplateGateResult or a Response the handler should return
 * verbatim. The instanceof-Response check at the call site keeps the happy
 * path linear.
 */
export async function requireTemplate(
  ctx: Parameters<PagesFunction<Env>>[0],
  templateId: string,
  opts: TemplateGateOptions = {},
): Promise<TemplateGateResult | Response> {
  const tenant = requireTenant(ctx)
  if (tenant.templateId !== templateId) return notFound()

  const email = await currentEmail(ctx.request, ctx.env.SESSION_SECRET)
  if (!email) return unauthorized()

  const isOwner =
    tenant.ownerEmail.toLowerCase() === email.toLowerCase() ||
    (isAdmin(ctx.env, email) && tenant.flags.isOperator === true)

  if (opts.ownerOnly && !isOwner) return forbidden()

  return { tenant, email, isOwner }
}
