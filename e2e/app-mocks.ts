/**
 * Deterministic fixtures + API mocks for the AUTHENTICATED screenshot suite
 * (e2e/app-screenshots.spec.ts). The public suite (mocks.ts) only fulfils the
 * public read endpoints; this module adds everything the signed-in surface
 * needs — /api/me, sessions, payments, advancements, and the admin endpoints —
 * so session pages, the intake form steps, and the admin shell render real,
 * representative content under `vite preview` (no backend).
 *
 * Every value here is a fixed constant. Combined with `page.clock.setFixedTime`
 * in the spec, the rendered output is byte-stable across runs — the same
 * contract the public baselines rely on.
 *
 * Shapes mirror the frontend API bindings (sessionsApi/paymentsApi/
 * advancementsApi/todayApi/vouchesApi). The server is the source of truth; if
 * those types change, update here too.
 */

import type { Page } from '@playwright/test'
import { installApiMocks } from './mocks'
import type { MessageRow, SessionRow, SessionStatus } from '../src/lib/sessionsApi'
import type { AdvancementRow } from '../src/lib/advancementsApi'
import type { PaymentSummary } from '../src/lib/paymentsApi'
import type { TodayResponse } from '../src/lib/todayApi'
import type { AdminVouch } from '../src/lib/vouchesApi'

export type Role = 'none' | 'user' | 'admin'

const USER_EMAIL = 'genevieve.bouchard@exemple.ca'
const ADMIN_EMAIL = 'marc@marcportal.com'

/** Fixed "now" the spec pins via page.clock — keep fixtures a few days behind
 *  so SLA/age math lands in a sensible, stable window. */
export const FIXED_NOW_MS = Date.UTC(2026, 2, 2, 15, 0, 0) // 2026-03-02T15:00:00Z
const DAY = 86_400
const NOW_S = Math.floor(FIXED_NOW_MS / 1000)
const D = (daysAgo: number) => NOW_S - daysAgo * DAY

const ME: Record<Role, { email: string | null; isAdmin: boolean }> = {
  none: { email: null, isAdmin: false },
  user: { email: USER_EMAIL, isAdmin: false },
  admin: { email: ADMIN_EMAIL, isAdmin: true },
}

/** A representative `rescue`-type intake — the schema with the longest radio
 *  option labels, so the form steps stress label wrapping. */
const INTAKE_JSON = JSON.stringify({
  type: 'rescue',
  account: { email: USER_EMAIL, name: 'Geneviève Bouchard' },
  submittedAt: new Date(D(6) * 1000).toISOString(),
  lang: 'fr',
  formData: {
    rescueKind: 'codebase',
    builtWith: 'WordPress 2015 + thème sur mesure',
    whereItLives: 'Un vieux serveur cPanel, accès FTP. Je peux te donner les identifiants.',
    whatsBroken:
      'Ça plante quand plusieurs personnes l’utilisent en même temps, pis le gars qui l’a fait a disparu.',
    inUse: 'halfway',
    idealOutcome: 'Que ça tienne le coup quand 10 personnes sont dessus, pis que ce soit à moi.',
    __handoff_mode: 'je-men-occupe',
  },
})

function makeSession(over: Partial<SessionRow> & { status: SessionStatus }): SessionRow {
  return {
    id: 'demo-session',
    email: USER_EMAIL,
    intake_json: INTAKE_JSON,
    created_at: D(6),
    updated_at: D(2),
    deleted_at: null,
    status_history: JSON.stringify([
      { from: 'draft', to: 'triage', by: ADMIN_EMAIL, at: D(5) },
      { from: 'triage', to: 'active', by: ADMIN_EMAIL, at: D(4) },
    ]),
    showcased_at: null,
    showcase_title: null,
    showcase_tagline: null,
    tier: null,
    tier4_amount_cents: null,
    tier3_split: null,
    custodian_status: null,
    custodian_plan: null,
    all_yours_acknowledged_at: null,
    decline_note: null,
    community_discount: 0,
    napkin_attachment_id: null,
    ...over,
  }
}

const MESSAGES: MessageRow[] = [
  {
    id: 'm1',
    session_id: 'demo-session',
    author: 'visitor',
    body: 'Allô Marc, voici le contexte. Le site plante quand on est plusieurs dessus.',
    created_at: D(5),
    attachments: [],
  },
  {
    id: 'm2',
    session_id: 'demo-session',
    author: 'marc',
    body: 'Reçu. Je regarde ça à soir pis je te reviens avec une première lecture.',
    created_at: D(4),
    attachments: [],
  },
]

const ADVANCEMENTS: AdvancementRow[] = [
  {
    id: 'a1',
    session_id: 'demo-session',
    date: D(3),
    author: ADMIN_EMAIL,
    label: 'Rev 1 — lecture du code + première démo',
    body: 'J’ai isolé le bug de concurrence. Démo déployée, regarde le lien.',
    build_url: 'https://demo-rev1.marc-portal.pages.dev',
    commit_sha: 'abc1234',
    iframe_path: '/',
    flags_json: '{"showInConversation":true,"showAsCurrentBuild":true}',
    flags: { showInConversation: true, showAsCurrentBuild: true },
    created_at: D(3),
    updated_at: D(3),
  },
]

function paymentSummary(over: Partial<PaymentSummary> = {}): PaymentSummary {
  return {
    rows: [],
    custodianStatus: 'none',
    stripeMode: 'test',
    build: null,
    scoping: { paid: false },
    ...over,
  }
}

/** Build a session-list fixture spanning the statuses admin lists group by. */
function sessionList(): SessionRow[] {
  return [
    makeSession({ id: 's-active', status: 'active', tier: 2, updated_at: D(1) }),
    makeSession({ id: 's-triage', status: 'triage', tier: null, updated_at: D(2) }),
    makeSession({
      id: 's-shipped',
      status: 'shipped',
      tier: 3,
      showcased_at: D(1),
      showcase_title: 'Portail bénévoles Maison Verte',
      custodian_status: 'active',
      custodian_plan: 'care',
    }),
    makeSession({ id: 's-draft', status: 'draft', email: 'autre@exemple.ca' }),
    makeSession({
      id: 's-rejected',
      status: 'rejected',
      decline_note: 'Trop gros pour une seule personne — je te réfère à un collègue.',
    }),
  ]
}

const VOUCHES: AdminVouch[] = [
  {
    id: 'v-pending',
    author_name: 'Sophie Tremblay',
    author_email: 'sophie@exemple.ca',
    author_relationship: 'client',
    body: 'Marc a compris mon besoin en une conversation. La démo à chaque étape m’a évité les mauvaises surprises.',
    link_url: null,
    session_id: null,
    created_at: D(2),
    status: 'pending',
    approved_at: null,
    deleted_at: null,
  },
  {
    id: 'v-approved',
    author_name: 'Marc-André Côté',
    author_email: 'macote@exemple.ca',
    author_relationship: 'colleague',
    body: 'Travailler en async avec lui est reposant : tout est écrit, rien ne se perd. Le fil par projet garde le contexte au même endroit.',
    link_url: null,
    session_id: null,
    created_at: D(10),
    status: 'approved',
    approved_at: D(9),
    deleted_at: null,
  },
]

const TODAY: TodayResponse = {
  sessions: [
    {
      session: makeSession({ id: 's-active', status: 'active', tier: 2, updated_at: D(1) }),
      nextAction: {
        code: 'installment_unpaid',
        severity: 'warn',
        label_fr: 'Versement en attente',
        label_en: 'Installment unpaid',
        hint_fr: 'Le premier versement n’est pas encore payé.',
        hint_en: 'The first installment is not paid yet.',
      },
      lastVisitorMessageAt: D(5),
      lastMarcMessageAt: D(4),
      paidBuildLegs: 0,
      pendingBuildLegs: 2,
      failedBuildLegs: 0,
      noteSnippet: 'Attend le devis avant de pousser la rev 2.',
      noteUpdatedAt: D(2),
    },
  ],
  overduePayments: [],
  slaBreaches: [
    { sessionId: 's-triage', email: USER_EMAIL, status: 'triage', ageSeconds: 3 * DAY },
  ],
  unansweredMessages: [],
  systemHealth: {
    outboxPending: 0,
    outboxStuck: 0,
    emailBouncesLast7d: 0,
    emailComplaintsLast7d: 0,
    openAdminAlerts: 0,
    capacity: { active: 1, triage: 0, activeCap: 1, triageCap: 2 },
    lastDigestAtS: D(0) - 3600,
    digestStale: false,
  },
  custodianAlerts: { pastDue: [], recentSwitches: [] },
  generatedAtS: NOW_S,
}

const AUDIT = [
  {
    id: 'au1',
    ts: D(1),
    actorEmail: ADMIN_EMAIL,
    tenantId: null,
    tenantSlug: null,
    action: 'session.tier.set',
    payload: { sessionId: 's-active', tier: 2 },
  },
  {
    id: 'au2',
    ts: D(3),
    actorEmail: ADMIN_EMAIL,
    tenantId: null,
    tenantSlug: null,
    action: 'session.status.advance',
    payload: { sessionId: 's-active', to: 'active' },
  },
]

const OUTBOX = [
  {
    id: 'o1',
    toEmail: USER_EMAIL,
    subject: 'Ta session est prête à être regardée',
    kind: 'session_update',
    createdAt: D(1),
    attempts: 2,
    lastAttempt: D(0) - 7200,
    lastError: 'Resend 429 — rate limited',
  },
]

/** A small inline SVG that stands in for the napkin PNG so NapkinArc renders a
 *  real image instead of its broken/onError fallback. */
const NAPKIN_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="380">' +
  '<rect width="600" height="380" fill="#fbf7ec"/>' +
  '<rect x="60" y="80" width="180" height="120" fill="none" stroke="#1f1d18" stroke-width="3"/>' +
  '<path d="M260 140 L420 140" stroke="#1f1d18" stroke-width="3" marker-end="url(#a)"/>' +
  '<rect x="420" y="90" width="120" height="100" fill="none" stroke="#1f1d18" stroke-width="3"/>' +
  '</svg>'

export interface AppMockOpts {
  role: Role
  session?: SessionRow
  sessions?: SessionRow[]
  messages?: MessageRow[]
  advancements?: AdvancementRow[]
  payment?: PaymentSummary
  /** When set, /api/intake-drafts returns this payload — drives the intake
   *  confirmation step via the signed-in server-draft recovery path
   *  (Intake.tsx:166), which is the only way to reach `submittedAt` state
   *  (loadActiveDraft drops a submitted draft from localStorage on load). */
  intakeDraft?: unknown
}

/**
 * Install the authenticated-surface mocks. Reuses the public mocks first
 * (capacity/projects/og + the EN-nudge dismissal), then layers the signed-in
 * endpoints. Regex routes are used for precise matching — `/api/sessions`
 * (list), `/api/sessions/:id` (detail) and the sub-resources are disjoint and
 * never collide.
 */
export async function installAppMocks(page: Page, opts: AppMockOpts): Promise<void> {
  await installApiMocks(page)

  const me = ME[opts.role]
  const session = opts.session ?? makeSession({ status: 'active', tier: 2 })
  const sessions = opts.sessions ?? sessionList()
  const messages = opts.messages ?? MESSAGES
  const advancements = opts.advancements ?? ADVANCEMENTS
  const payment = opts.payment ?? paymentSummary()

  const json = (data: unknown) => ({ json: data })

  await page.route(/\/api\/me(\?|$)/, (route) => {
    if (route.request().method() === 'DELETE') return route.fulfill(json({ ok: true }))
    return route.fulfill(json(me))
  })
  await page.route(/\/api\/me\/prefs/, (route) => route.fulfill(json({ ok: true })))
  await page.route(/\/api\/intake-drafts/, (route) =>
    route.fulfill(
      json(
        opts.intakeDraft
          ? { draft: { payload: opts.intakeDraft, createdAt: D(2), updatedAt: D(1) } }
          : { draft: null },
      ),
    ),
  )

  // List vs create — same path, split on method.
  await page.route(/\/api\/sessions(\?|$)/, (route) =>
    route.request().method() === 'POST'
      ? route.fulfill(json({ session }))
      : route.fulfill(json({ sessions })),
  )
  // Sub-resources (register before the bare detail so the more specific
  // patterns win — Playwright matches most-recently-added first).
  await page.route(/\/api\/sessions\/[^/]+\/messages/, (route) =>
    route.request().method() === 'POST'
      ? route.fulfill(json({ message: messages[messages.length - 1] }))
      : route.fulfill(json({ messages })),
  )
  await page.route(/\/api\/sessions\/[^/]+\/advancements/, (route) =>
    route.fulfill(json({ advancements })),
  )
  await page.route(/\/api\/sessions\/[^/]+\/attachments\/[^/]+/, (route) =>
    route.fulfill({ contentType: 'image/svg+xml', body: NAPKIN_SVG }),
  )
  await page.route(/\/api\/sessions\/[^/]+\/attachments(\?|$)/, (route) =>
    route.fulfill(json({ attachments: [] })),
  )
  await page.route(/\/api\/sessions\/[^/]+(\?|$)/, (route) => route.fulfill(json({ session })))
  await page.route(/\/api\/payments(\?|$)/, (route) => route.fulfill(json(payment)))
  await page.route(/\/api\/payments\/(checkout|portal)/, (route) =>
    route.fulfill(json({ url: 'https://checkout.stripe.com/demo', paymentId: 'pi_demo' })),
  )

  // Admin endpoints.
  await page.route(/\/api\/admin\/today/, (route) => route.fulfill(json(TODAY)))
  await page.route(/\/api\/admin\/vouches/, (route) => route.fulfill(json({ vouches: VOUCHES })))
  await page.route(/\/api\/admin\/audit/, (route) => route.fulfill(json({ entries: AUDIT })))
  await page.route(/\/api\/admin\/email-outbox/, (route) =>
    route.fulfill(json({ entries: OUTBOX })),
  )
  await page.route(/\/api\/admin\/sessions\/[^/]+\/notes/, (route) =>
    route.fulfill(json({ notes: [] })),
  )
}

/** Fixture builders + ready data the scenario list composes. */
export const fixtures = {
  USER_EMAIL,
  ADMIN_EMAIL,
  makeSession,
  paymentSummary,
  D,
  INTAKE_JSON,
}
