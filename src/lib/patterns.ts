import type { Lang } from '../i18n'

/** Visual tone used by Tier0 cards to differentiate pattern categories at a
 *  glance — coloured left-border + matching tag pill. Sage/warm/sand/navy
 *  cycle through the brand palette without overpowering it. */
export type PatternTone = 'sage' | 'warm' | 'sand' | 'navy'

export interface SelfServicePattern {
  id: string
  /** One-word category shown as an eyebrow pill on the card. */
  tag: { fr: string; en: string }
  /** Brand-palette accent for left-border + tag chip. */
  tone: PatternTone
  title: { fr: string; en: string }
  problem: { fr: string; en: string }
  recipe: { fr: string; en: string }
  template?: { label: { fr: string; en: string }; href: string }
}

export const PATTERNS: SelfServicePattern[] = [
  {
    id: 'snow-rotation',
    tag: { fr: 'rotation', en: 'rotation' },
    tone: 'sage',
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
    tag: { fr: 'sondage', en: 'poll' },
    tone: 'warm',
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
    tag: { fr: 'registre', en: 'log' },
    tone: 'sand',
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
    tag: { fr: 'inventaire partagé', en: 'shared inventory' },
    tone: 'navy',
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
  {
    id: 'sugar-shack-potluck',
    tag: { fr: 'potluck', en: 'potluck' },
    tone: 'sage',
    title: {
      fr: 'Cabane à sucre — qui apporte quoi',
      en: 'Sugar shack — who brings what',
    },
    problem: {
      fr: '25 personnes vont à la cabane à sucre familiale. Sans coordination, on arrive avec 4 tartes au sucre et zéro salade.',
      en: '25 people are heading to the family sugar shack. Without coordination, you end up with 4 maple-sugar pies and zero salad.',
    },
    recipe: {
      fr: "Google Sheets : colonne A = plat à apporter (tarte, salade, jambon, chaudière de sirop), colonne B = qui (vide au début). Tout le monde a le lien, chacun se met sur ce qu'il apporte. Premier arrivé, premier servi. Tu peux geler la liste 3 jours avant.",
      en: 'Google Sheets: column A = dish to bring (pie, salad, ham, bucket of syrup), column B = who (empty at first). Everyone has the link, each person signs up for what they bring. First-come, first-served. Freeze the list 3 days before.',
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
    id: 'shared-expenses',
    tag: { fr: 'partage des coûts', en: 'cost splitting' },
    tone: 'warm',
    title: {
      fr: 'Dépenses partagées (chalet, road trip, voyage)',
      en: 'Shared expenses (cabin trip, road trip, vacation)',
    },
    problem: {
      fr: "Quatre amis louent un chalet. À la fin du weekend, personne ne se souvient qui a payé l'épicerie, le bois, l'essence — et personne ne veut faire le calcul.",
      en: 'Four friends rent a cabin. By the end of the weekend, nobody remembers who paid for groceries, firewood, gas — and nobody wants to do the math.',
    },
    recipe: {
      fr: "Splitwise (app gratuite). Crée un groupe avec les 4 amis. Chaque fois que quelqu'un paye quelque chose, l'entrer dans l'app. À la fin, Splitwise dit « Marie doit 47 $ à Pat ». Aucune chicane, aucun calcul.",
      en: 'Splitwise (free app). Create a group with the four of you. Each time someone pays, enter it in the app. At the end, Splitwise says "Marie owes Pat $47." No fights, no math.',
    },
    template: {
      label: { fr: 'Splitwise (gratuit)', en: 'Splitwise (free)' },
      href: 'https://www.splitwise.com/',
    },
  },
  {
    id: 'kids-clothes-exchange',
    tag: { fr: 'échange', en: 'exchange' },
    tone: 'sand',
    title: {
      fr: 'Bourse aux vêtements pour enfants (groupe de parents)',
      en: 'Kids clothing exchange (parent group)',
    },
    problem: {
      fr: 'Huit familles avec des enfants de 2 à 8 ans. Vous voulez vous échanger les vêtements trop petits sans rien acheter. Personne ne se rappelle qui a la combinaison de neige 4T cette année.',
      en: 'Eight families with kids aged 2 to 8. You want to swap outgrown clothes without buying anything new. Nobody remembers who has the 4T snowsuit this year.',
    },
    recipe: {
      fr: "Un groupe Facebook privé ou un canal Signal. Format de post fixe : taille + item + dispo/cherche + photo. Premier arrivé, premier servi. Pas besoin d'app dédiée — la simplicité du fil chronologique fait la job.",
      en: 'A private Facebook group or Signal channel. Fixed post format: size + item + offering/looking-for + photo. First-come, first-served. No dedicated app needed — a simple chronological thread does the job.',
    },
  },
  {
    id: 'hockey-tournament-signup',
    tag: { fr: 'inscription', en: 'sign-up' },
    tone: 'navy',
    title: {
      fr: 'Inscription tournoi de hockey de quartier',
      en: 'Local hockey tournament sign-up',
    },
    problem: {
      fr: "Tu organises un tournoi 3-contre-3 à l'aréna municipale, max 8 équipes. Tu veux pas faire le suivi des inscriptions au téléphone et par texto.",
      en: "You're organizing a 3-on-3 tournament at the local arena, max 8 teams. You don't want to track sign-ups by phone and text.",
    },
    recipe: {
      fr: "Google Forms (gratuit). Un formulaire : nom de l'équipe, capitaine, 5 joueurs minimum, courriel pour les nouvelles. Active la limite à 8 réponses. Tout finit dans un Google Sheets que tu peux trier et imprimer.",
      en: 'Google Forms (free). One form: team name, captain, 5 players minimum, email for updates. Set the response limit to 8. Everything flows into a Google Sheets you can sort and print.',
    },
    template: {
      label: { fr: 'Google Forms (gratuit)', en: 'Google Forms (free)' },
      href: 'https://forms.google.com/',
    },
  },
  {
    id: 'wedding-tasks',
    tag: { fr: 'mariage', en: 'wedding' },
    tone: 'sage',
    title: {
      fr: 'Tâches partagées pour la noce',
      en: 'Shared wedding task list',
    },
    problem: {
      fr: 'Vous vous mariez dans 4 mois. La belle-mère veut aider mais sait pas où, ton chum oublie la moitié des courriels, et toi tu veux pas tout porter toute seule.',
      en: "You're getting married in 4 months. Your mother-in-law wants to help but doesn't know where, your partner forgets half the emails, and you don't want to carry it all alone.",
    },
    recipe: {
      fr: "Trello (gratuit). Une carte par tâche (réserver le DJ, choisir les fleurs, écrire les vœux, etc.). Drag-and-drop pour assigner. Quand c'est fait, ça glisse dans la colonne « terminé ». Visible par tout le monde, tout le temps.",
      en: 'Trello (free). One card per task (book the DJ, pick the flowers, write the vows, etc.). Drag-and-drop to assign. When it\'s done, it slides into the "done" column. Visible to everyone, always.',
    },
    template: {
      label: { fr: 'Trello (gratuit)', en: 'Trello (free)' },
      href: 'https://trello.com/',
    },
  },
  {
    id: 'neighborhood-newsletter',
    tag: { fr: 'infolettre', en: 'newsletter' },
    tone: 'warm',
    title: {
      fr: 'Bulletin de quartier mensuel',
      en: 'Monthly neighborhood newsletter',
    },
    problem: {
      fr: 'Tu es bénévole pour ton association de quartier. Tu veux envoyer un bulletin une fois par mois à 80 voisins sans payer un service de courriel.',
      en: 'You volunteer for your neighborhood association. You want to send a monthly newsletter to 80 neighbors without paying for an email service.',
    },
    recipe: {
      fr: "Brevo (anciennement Sendinblue, gratuit jusqu'à 300 envois/jour). Importe ta liste, écris ton bulletin dans l'éditeur, envoie. Tu vois qui ouvre, qui clique. Si ta liste grossit au-delà de 500 personnes, là on en reparle — c'est rendu Tier 1.",
      en: "Brevo (formerly Sendinblue, free up to 300 sends/day). Import your list, write the newsletter in the editor, send. See who opens, who clicks. If your list grows past 500 people, then come back — that's Tier 1.",
    },
    template: {
      label: { fr: 'Brevo (gratuit)', en: 'Brevo (free)' },
      href: 'https://www.brevo.com/',
    },
  },
  {
    id: 'boat-log',
    tag: { fr: 'entretien', en: 'maintenance' },
    tone: 'sand',
    title: {
      fr: "Carnet de bord d'un bateau (heures moteur, entretien)",
      en: 'Boat log (engine hours, maintenance)',
    },
    problem: {
      fr: 'Ton bateau a un moteur qui demande une vidange à chaque 100 heures. Tu te souviens jamais où tu en es, et le mécanicien te le demande à chaque printemps.',
      en: 'Your boat has a motor that needs an oil change every 100 hours. You never remember where you stand, and the mechanic asks you every spring.',
    },
    recipe: {
      fr: "Un carnet papier dans le bateau, OU une note Apple Notes / Google Keep. À chaque sortie : date / heures au départ / heures au retour / ce que tu as fait (vidange, hélice changée, plein d'essence). C'est tout. Pas besoin de logiciel dédié.",
      en: "A paper logbook in the boat, OR an Apple Notes / Google Keep note. Each trip: date / hours at start / hours at end / what you did (oil change, propeller swap, refuel). That's it. No dedicated software needed.",
    },
  },
  {
    id: 'dog-rotation',
    tag: { fr: 'rotation', en: 'rotation' },
    tone: 'navy',
    title: {
      fr: "Garde du chien pendant les vacances (groupe d'amis)",
      en: 'Dog-sitting during vacations (friend group)',
    },
    problem: {
      fr: 'Quatre amis avec des chiens. Chacun part en vacances 2-3 fois par an. Vous voulez vous garder mutuellement les chiens sans payer une pension à 50 $/jour.',
      en: 'Four friends with dogs. Each one goes on vacation 2-3 times a year. You want to dog-sit for each other instead of paying a kennel at $50/day.',
    },
    recipe: {
      fr: "Un groupe WhatsApp. Quelqu'un poste « vacances du 15 au 22 juin, Rex cherche un toit ». Premier répondant garde. Tu peux ajouter un Google Sheets épinglé qui compte « qui a gardé qui combien de fois » pour rester juste sur le long terme.",
      en: 'A WhatsApp group. Someone posts "vacation June 15-22, Rex needs a place." First reply gets the dog. Optionally pin a Google Sheets tracking "who watched whose dog how many times" to stay fair over time.',
    },
  },
]

export function listPatterns(): SelfServicePattern[] {
  return PATTERNS
}

export function localizedPattern<T extends { fr: string; en: string }>(obj: T, lang: Lang): string {
  return obj[lang] ?? obj.fr
}
