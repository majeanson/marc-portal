import type { Lang } from '../i18n'

export interface SelfServicePattern {
  id: string
  title: { fr: string; en: string }
  problem: { fr: string; en: string }
  recipe: { fr: string; en: string }
  template?: { label: { fr: string; en: string }; href: string }
}

export const PATTERNS: SelfServicePattern[] = [
  {
    id: 'snow-rotation',
    title: {
      fr: 'Rotation de pelletage de la rue',
      en: 'Street snow-shoveling rotation',
    },
    problem: {
      fr: "Tu coordonnes le déneigement avec 6-12 voisins. Personne ne se souvient à qui c'est le tour ce samedi.",
      en: 'You coordinate snow-shoveling with 6-12 neighbours. Nobody remembers whose turn it is this Saturday.',
    },
    recipe: {
      fr: "Un Google Sheets : colonne A = nom, colonne B = date du dernier tour. Trie par colonne B, le plus ancien est le prochain. Partage en lecture-seule au groupe Facebook. Tu coches après chaque tempête. C'est assez.",
      en: "A Google Sheets: column A = name, column B = date of last turn. Sort by column B, oldest is next. Share read-only to the Facebook group. Check off after each storm. That's enough.",
    },
    template: {
      label: {
        fr: 'Modèle Google Sheets (à dupliquer)',
        en: 'Google Sheets template (duplicate it)',
      },
      href: 'https://docs.google.com/spreadsheets/u/0/?tgif=d',
    },
  },
  {
    id: 'rsvp',
    title: {
      fr: 'RSVP pour un événement à 20-50 personnes',
      en: 'RSVP for a 20-50 person event',
    },
    problem: {
      fr: 'Tu organises un party de quartier ou une fête de famille. Tu ne veux pas faire le compte des oui/non sur Facebook Messenger.',
      en: "You're organizing a neighbourhood party or family gathering. You don't want to count yes/no replies on Facebook Messenger.",
    },
    recipe: {
      fr: 'Doodle ou Framadate (gratuit, hébergé en France, pas de compte requis). Crée un sondage avec 1 question (oui/non). Partage le lien. Tu vois les réponses en temps réel. Aucun ré-saisie.',
      en: 'Doodle or Framadate (free, hosted in France, no account needed). Create a poll with 1 question (yes/no). Share the link. See answers in real time. No re-entering.',
    },
    template: {
      label: { fr: 'Framadate (gratuit, FR)', en: 'Framadate (free, FR)' },
      href: 'https://framadate.org/',
    },
  },
  {
    id: 'hours-tracker',
    title: {
      fr: "Suivi d'heures pour 1-3 employés",
      en: 'Hours tracker for 1-3 employees',
    },
    problem: {
      fr: "Tu veux savoir combien d'heures tes 2 employés ont fait cette semaine sans payer un logiciel.",
      en: 'You want to know how many hours your 2 employees worked this week without paying for software.',
    },
    recipe: {
      fr: "Un Google Sheets : colonne A = date, B = employé, C = heures, D = chantier. Chaque employé écrit ses heures lui-même chaque jour. Total automatique en bas avec SUM. Si tu as 4+ employés, là c'est Tier 2 et ça vaut la peine.",
      en: "A Google Sheets: column A = date, B = employee, C = hours, D = job site. Each employee writes their own hours daily. Auto-total at the bottom with SUM. If you have 4+ employees, that's Tier 2 and worth investing in.",
    },
  },
  {
    id: 'lending-board',
    title: {
      fr: 'Tableau de prêts entre voisins (perceuse, échelle…)',
      en: 'Neighbourhood lending board (drill, ladder…)',
    },
    problem: {
      fr: 'Trois voisins se prêtent des outils mais personne ne se souvient qui a quoi.',
      en: 'Three neighbours lend each other tools but nobody remembers who has what.',
    },
    recipe: {
      fr: "Notion (plan gratuit) avec une base de données : item / propriétaire / emprunté par / date de retour. Lien partagé en lecture-écriture. Tu peux aussi faire ça avec un groupe Signal et la fonction d'épingler — pas besoin d'app.",
      en: 'Notion (free plan) with a database: item / owner / borrowed by / return date. Shared read-write link. Or use a Signal group with the pin feature — no app needed.',
    },
    template: {
      label: { fr: 'Notion (gratuit)', en: 'Notion (free)' },
      href: 'https://www.notion.so/',
    },
  },
]

export function listPatterns(): SelfServicePattern[] {
  return PATTERNS
}

export function localizedPattern<T extends { fr: string; en: string }>(obj: T, lang: Lang): string {
  return obj[lang] ?? obj.fr
}
