import type { Lang } from '../i18n'

export type EngagementStage = 'triage' | 'planning' | 'building' | 'review' | 'shipped'

export type MessageType = 'update' | 'decision' | 'question' | 'system'
export type MessageAuthor = 'marc' | 'client' | 'system'

export interface EngagementMessage {
  id: string
  date: string
  type: MessageType
  author: MessageAuthor
  body: { fr: string; en: string }
}

export interface StageEvent {
  stage: EngagementStage
  date: string | null
  completed: boolean
  current?: boolean
}

export interface Engagement {
  slug: string
  client: string
  title: { fr: string; en: string }
  problem: { fr: string; en: string }
  tier: 'Tier 1' | 'Tier 2' | 'Tier 3'
  startedDate: string
  primaryLang: Lang
  livePreviewUrl: string | null
  livePreviewNote: { fr: string; en: string }
  stages: StageEvent[]
  messages: EngagementMessage[]
  relatedShowcaseSlug?: string
}

const TREMBLAY_LANDSCAPING: Engagement = {
  slug: 'tremblay-paysagement-suivi-clients',
  client: 'Tremblay Paysagement (composite)',
  primaryLang: 'fr',
  title: {
    fr: 'Tremblay Paysagement — suivi des 40 clients sans Excel cassé',
    en: 'Tremblay Landscaping — 40-client tracking without the broken Excel',
  },
  problem: {
    fr: 'Marie suit 40 clients avec un Excel partagé entre son chum et elle. Trois fois par mois, elle oublie de facturer un déneigement et perd ~$3000/an. Elle ne veut pas une nouvelle app — elle veut que la prochaine visite chez Lavoie déclenche automatiquement la facture.',
    en: "Marie tracks 40 clients in an Excel shared between her and her partner. Three times a month she forgets to invoice a snow-clearing job and loses ~$3000/yr. She doesn't want another app — she wants the next visit at Lavoie's place to auto-trigger an invoice.",
  },
  tier: 'Tier 2',
  startedDate: '2026-04-22',
  livePreviewUrl: null,
  livePreviewNote: {
    fr: "Aperçu déployable au jour 5 — Marie peut poker l'outil avant qu'il soit fini.",
    en: 'Deployable preview at day 5 — Marie can poke the tool before it ships.',
  },
  stages: [
    { stage: 'triage', date: '2026-04-22', completed: true },
    { stage: 'planning', date: '2026-04-23', completed: true },
    { stage: 'building', date: '2026-04-25', completed: false, current: true },
    { stage: 'review', date: null, completed: false },
    { stage: 'shipped', date: null, completed: false },
  ],
  messages: [
    {
      id: 'm-1',
      date: '2026-04-22',
      type: 'system',
      author: 'system',
      body: {
        fr: 'Formulaire reçu — Marc lit dans les 72 h.',
        en: 'Form received — Marc reads within 72h.',
      },
    },
    {
      id: 'm-2',
      date: '2026-04-22',
      type: 'update',
      author: 'marc',
      body: {
        fr: "Salut Marie, c'est reçu. Je relis ton formulaire ce soir et je te reviens demain matin avec un oui/non/raconte-moi-plus.",
        en: "Hi Marie, got it. I'll re-read your form tonight and come back tomorrow morning with a yes/no/tell-me-more.",
      },
    },
    {
      id: 'm-3',
      date: '2026-04-23',
      type: 'decision',
      author: 'marc',
      body: {
        fr: "Oui, je peux faire ça. Scoping comme Tier 2 (~$1500). Inclus : (1) liste de 40 clients avec dernière visite, (2) déclencheur 'visite faite → brouillon de facture en attente', (3) export TPS/TVQ-ready. Hors scope : portail client, paiements en ligne. Réponds 'go' pour confirmer; je commence lundi.",
        en: "Yes, I can do this. Scoping as Tier 2 (~$1500). Included: (1) 40-client list with last-visit date, (2) trigger 'visit done → draft invoice queued', (3) GST/QST-ready export. Out of scope: client portal, online payments. Reply 'go' to confirm; I start Monday.",
      },
    },
    {
      id: 'm-4',
      date: '2026-04-23',
      type: 'update',
      author: 'client',
      body: {
        fr: "Go. Et merci de pas vouloir me vendre un portail client — j'aurais dit non de toute façon.",
        en: 'Go. And thanks for not trying to sell me a client portal — I would have said no anyway.',
      },
    },
    {
      id: 'm-5',
      date: '2026-04-25',
      type: 'system',
      author: 'system',
      body: {
        fr: 'Étape "construction" commencée. Aperçu testable cible : 2026-04-30.',
        en: 'Stage "building" started. Testable preview target: 2026-04-30.',
      },
    },
    {
      id: 'm-6',
      date: '2026-04-26',
      type: 'question',
      author: 'marc',
      body: {
        fr: "Question pour le déclencheur — quand tu dis 'visite faite', c'est toi qui coches dans une liste, ou ton chum aussi peut le faire? J'avais supposé toi seulement.",
        en: "Question on the trigger — when you say 'visit done,' is it you who checks it off, or can your partner too? I assumed only you.",
      },
    },
    {
      id: 'm-7',
      date: '2026-04-26',
      type: 'update',
      author: 'client',
      body: {
        fr: "Lui aussi. Souvent c'est lui qui fait la run du matin pendant que je suis avec les enfants.",
        en: "Him too. Often he does the morning run while I'm with the kids.",
      },
    },
    {
      id: 'm-8',
      date: '2026-04-27',
      type: 'decision',
      author: 'marc',
      body: {
        fr: "Compris — j'ajoute deux comptes (toi + ton chum) avec accès partagé. Aucun coût additionnel, c'était dans le scope original.",
        en: 'Understood — adding two accounts (you + partner) with shared access. No additional cost, that was within original scope.',
      },
    },
  ],
  relatedShowcaseSlug: undefined,
}

const ALL_ENGAGEMENTS: Engagement[] = [TREMBLAY_LANDSCAPING]

export function getEngagementBySlug(slug: string): Engagement | null {
  return ALL_ENGAGEMENTS.find((e) => e.slug === slug) ?? null
}

export function listEngagements(): Engagement[] {
  return ALL_ENGAGEMENTS
}
