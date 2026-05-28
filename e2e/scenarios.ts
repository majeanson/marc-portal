/**
 * Scenario manifest for the AUTHENTICATED + multi-step screenshot suite
 * (e2e/app-screenshots.spec.ts). Each scenario is a (route, auth role, mocked
 * data, localStorage seed, optional click) tuple chosen so that collectively
 * they render every distinct form / panel layout at least once — the surfaces
 * the public suite (routes.ts) can't reach because they're dynamic, admin, or
 * gated behind a multi-step interaction.
 *
 * FR is the primary language: it carries the longest copy, so it's the real
 * overflow stress case. A few form-dense scenarios add an EN twin to check
 * parity without doubling the whole corpus.
 */

import type { Page } from '@playwright/test'
import type { AppMockOpts } from './app-mocks'
import { fixtures } from './app-mocks'

const { makeSession, paymentSummary, D, USER_EMAIL } = fixtures

export interface AppScenario {
  /** Filesystem-safe screenshot slug. */
  name: string
  /** URL path to visit. */
  path: string
  /** Auth identity the mocked /api/me returns. */
  role: AppMockOpts['role']
  /** Per-scenario data overrides layered onto the mock defaults. */
  mocks?: Omit<AppMockOpts, 'role'>
  /** localStorage entries to seed before the page loads (keys already include
   *  the `marc-portal:` prefix used by src/lib/draft.ts). */
  seed?: Record<string, string>
  /** Post-settle interaction to reach an opened/editing state. */
  prepare?: (page: Page) => Promise<void>
}

const DRAFT_KEY = 'marc-portal:intake-draft'
const VIBE_FLAG = 'marc-portal:intake-vibe-accepted'

const baseAccount = { email: USER_EMAIL, name: 'Geneviève Bouchard' }

/** Build summary for an active tier-2 session with the first leg owed. */
const activePayment = paymentSummary({
  build: {
    tier: 2,
    installmentCount: 2,
    paidCount: 0,
    nextIndex: 1,
    nextAmountCents: 90000,
    quotePending: false,
    community: false,
  },
})

/** Shipped, build fully paid, no custodian, ownership decision still open —
 *  the state that renders the all-yours skills checklist with its checkbox. */
const shippedPayment = paymentSummary({
  custodianStatus: 'none',
  build: {
    tier: 2,
    installmentCount: 2,
    paidCount: 2,
    nextIndex: null,
    nextAmountCents: null,
    quotePending: false,
    community: false,
  },
  scoping: { paid: true },
})

export const APP_SCENARIOS: AppScenario[] = [
  // ── Intake multi-step (signed-out; localStorage drives the step) ──────────
  { name: 'intake-vibe', path: '/intake', role: 'none' },
  {
    name: 'intake-account',
    path: '/intake',
    role: 'none',
    seed: { [VIBE_FLAG]: '1' },
  },
  {
    name: 'intake-type',
    path: '/intake',
    role: 'none',
    seed: {
      [VIBE_FLAG]: '1',
      [DRAFT_KEY]: JSON.stringify({ account: baseAccount, formData: {} }),
    },
  },
  {
    // Prime bug suspect: TypeForm's `field--handoff` fieldset + the rescue
    // schema's long radio/select option labels.
    name: 'intake-form',
    path: '/intake',
    role: 'none',
    seed: {
      [VIBE_FLAG]: '1',
      [DRAFT_KEY]: JSON.stringify({ account: baseAccount, type: 'rescue', formData: {} }),
    },
  },
  {
    name: 'en-intake-form',
    path: '/en/intake',
    role: 'none',
    seed: {
      [VIBE_FLAG]: '1',
      [DRAFT_KEY]: JSON.stringify({ account: baseAccount, type: 'rescue', formData: {} }),
    },
  },
  {
    // Voice-note-present state: the panel auto-opens (voiceOpen = !!voiceNapkin)
    // showing the "Say the problem out loud" head with the Hide/Remove actions
    // + the editable transcript. This is the state whose header overflowed on
    // mobile (Marc's screenshot) — baseline it so the fix can't regress.
    name: 'intake-voice',
    path: '/intake',
    role: 'none',
    seed: {
      [VIBE_FLAG]: '1',
      [DRAFT_KEY]: JSON.stringify({
        account: baseAccount,
        type: 'rescue',
        formData: {},
        voiceNapkin: {
          transcript:
            'Allô, fait que mon vieux site plante quand on est plusieurs dessus, pis je sais pas trop par où commencer. Aide-moi à voir clair là-dedans.',
          savedAt: new Date(D(1) * 1000).toISOString(),
        },
      }),
    },
  },
  {
    name: 'en-intake-voice',
    path: '/en/intake',
    role: 'none',
    seed: {
      [VIBE_FLAG]: '1',
      [DRAFT_KEY]: JSON.stringify({
        account: baseAccount,
        type: 'rescue',
        formData: {},
        voiceNapkin: {
          transcript:
            "Hey, so my old site crashes when a few of us are on it at once, and I'm not sure where to start. Help me see clearly through it.",
          savedAt: new Date(D(1) * 1000).toISOString(),
        },
      }),
    },
  },
  {
    // Confirmation needs `submittedAt`, which loadActiveDraft strips from
    // localStorage — reach it through the signed-in server-draft recovery.
    name: 'intake-confirmation',
    path: '/intake',
    role: 'user',
    mocks: {
      intakeDraft: {
        draft: {
          account: baseAccount,
          type: 'rescue',
          formData: { rescueKind: 'codebase' },
          submittedAt: new Date(D(0) * 1000).toISOString(),
          sessionId: 'demo-session',
          sessionStatus: 'triage',
        },
        lang: 'fr',
      },
    },
  },

  // ── Session page — visitor (user) view ────────────────────────────────────
  {
    name: 'session-user-active',
    path: '/session/demo-session',
    role: 'user',
    mocks: {
      session: makeSession({ status: 'active', tier: 2, napkin_attachment_id: 'nap1' }),
      payment: activePayment,
    },
  },
  {
    // Bug suspect: the all-yours skills checklist (checkbox + confirm) on a
    // shipped session.
    name: 'session-user-shipped',
    path: '/session/demo-session',
    role: 'user',
    mocks: {
      session: makeSession({
        status: 'shipped',
        tier: 2,
        showcased_at: D(1),
        showcase_title: 'Réparation du portail bénévoles',
        napkin_attachment_id: 'nap1',
      }),
      payment: shippedPayment,
    },
  },
  {
    name: 'en-session-user-shipped',
    path: '/en/session/demo-session',
    role: 'user',
    mocks: {
      session: makeSession({
        status: 'shipped',
        tier: 2,
        showcased_at: D(1),
        showcase_title: 'Volunteer portal rescue',
        napkin_attachment_id: 'nap1',
      }),
      payment: shippedPayment,
    },
  },
  {
    name: 'session-user-triage',
    path: '/session/demo-session',
    role: 'user',
    mocks: { session: makeSession({ status: 'triage' }) },
  },
  {
    name: 'session-user-rejected',
    path: '/session/demo-session',
    role: 'user',
    mocks: {
      session: makeSession({
        status: 'rejected',
        decline_note:
          'Honnêtement, c’est trop gros pour une seule personne — je te réfère à un collègue qui fait ça en équipe.',
      }),
    },
  },
  {
    // Bug suspect: IntakeSummary edit mode → radio/select/textarea field editors.
    name: 'session-user-intake-edit',
    path: '/session/demo-session',
    role: 'user',
    mocks: { session: makeSession({ status: 'active', tier: 2 }), payment: activePayment },
    prepare: async (page) => {
      const edit = page.getByRole('button', { name: 'Edit' }).first()
      if (await edit.count()) await edit.click()
    },
  },

  // ── Session page — admin view (/admin/inbox/:id) ──────────────────────────
  {
    name: 'session-admin-triage',
    path: '/admin/inbox/demo-session',
    role: 'admin',
    mocks: { session: makeSession({ status: 'triage' }) },
  },
  {
    name: 'session-admin-tier3',
    path: '/admin/inbox/demo-session',
    role: 'admin',
    mocks: {
      session: makeSession({ status: 'active', tier: 3, tier3_split: '40-40-20' }),
      payment: paymentSummary({
        build: {
          tier: 3,
          installmentCount: 3,
          paidCount: 0,
          nextIndex: 1,
          nextAmountCents: 60000,
          quotePending: false,
          community: false,
        },
      }),
    },
  },
  {
    name: 'session-admin-tier4',
    path: '/admin/inbox/demo-session',
    role: 'admin',
    mocks: { session: makeSession({ status: 'active', tier: 4, tier4_amount_cents: 480000 }) },
  },
  {
    name: 'session-admin-shipped',
    path: '/admin/inbox/demo-session',
    role: 'admin',
    mocks: {
      session: makeSession({
        status: 'shipped',
        tier: 2,
        showcased_at: D(1),
        showcase_title: 'Réparation du portail bénévoles',
        showcase_tagline: 'Un vieux WordPress remis sur pied, hébergé pour de bon.',
      }),
      payment: shippedPayment,
    },
  },

  // ── Admin shell pages ─────────────────────────────────────────────────────
  { name: 'admin-hub', path: '/admin', role: 'admin' },
  { name: 'admin-inbox', path: '/admin/inbox', role: 'admin' },
  { name: 'admin-today', path: '/admin/today', role: 'admin' },
  { name: 'admin-vouches', path: '/admin/vouches', role: 'admin' },
  { name: 'admin-audit', path: '/admin/audit', role: 'admin' },
  { name: 'admin-trash', path: '/admin/trash', role: 'admin' },
  { name: 'admin-custodians', path: '/admin/custodians', role: 'admin' },
  { name: 'admin-showcase', path: '/admin/showcase', role: 'admin' },
  { name: 'admin-email-outbox', path: '/admin/email-outbox', role: 'admin' },
  { name: 'admin-runbook', path: '/admin/runbook', role: 'admin' },

  // ── Authenticated misc ────────────────────────────────────────────────────
  { name: 'me-portal', path: '/me', role: 'user' },
  { name: 'my-data', path: '/me/data', role: 'user' },
  { name: 'me-dossier', path: '/me/dossier', role: 'user' },
]
