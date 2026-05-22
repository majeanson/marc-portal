import type { Lang } from '../i18n'

export type ProblemType = 'paperasse' | 'suivi' | 'coordination' | 'autre' | 'rescue'

export type FieldType = 'text' | 'textarea' | 'select' | 'radio' | 'number'

export interface FieldOption {
  value: string
  label: { fr: string; en: string }
}

export interface FieldDef {
  id: string
  type: FieldType
  label: { fr: string; en: string }
  placeholder?: { fr: string; en: string }
  options?: FieldOption[]
  required?: boolean
  hint?: { fr: string; en: string }
  rows?: number
}

export interface IntakeSchema {
  type: ProblemType
  title: { fr: string; en: string }
  description: { fr: string; en: string }
  fields: FieldDef[]
}

const TYPE_TITLES: Record<ProblemType, { fr: string; en: string }> = {
  paperasse: {
    fr: 'Paperasse à automatiser',
    en: 'Paperwork to automate',
  },
  suivi: {
    fr: 'Suivi (clients, inventaire, projets)',
    en: 'Tracking (clients, inventory, projects)',
  },
  coordination: {
    fr: 'Coordination (équipe, bénévoles, voisinage)',
    en: 'Coordination (team, volunteers, neighbours)',
  },
  autre: {
    fr: 'Autre — décris-moi ça librement',
    en: 'Other — describe it in your own words',
  },
  rescue: {
    fr: 'Réparer un truc qui existe déjà',
    en: 'Fix something that already exists',
  },
}

const TYPE_DESCRIPTIONS: Record<ProblemType, { fr: string; en: string }> = {
  paperasse: {
    fr: 'Pour les choses répétitives qui mangent ton dimanche soir : factures, soumissions, rapports, comptabilité de base.',
    en: 'For repetitive things that eat your Sunday night: invoices, quotes, reports, basic bookkeeping.',
  },
  suivi: {
    fr: 'Pour ce que tu gardes encore dans ta tête, dans Excel, ou sur des bouts de papier : clients, stock, projets en cours.',
    en: 'For what you still keep in your head, in Excel, or on scraps of paper: clients, stock, ongoing projects.',
  },
  coordination: {
    fr: 'Pour quand plusieurs personnes ont besoin de savoir qui fait quoi, quand : équipe, bénévoles, voisinage, comité.',
    en: 'For when several people need to know who does what, when: team, volunteers, neighbourhood, committee.',
  },
  autre: {
    fr: 'Si rien des autres types ne colle. Marc lit chaque formulaire lui-même et te répondra honnêtement.',
    en: 'If none of the other types fit. Marc reads every form himself and will reply honestly.',
  },
  rescue: {
    fr: "Tu as déjà quelque chose qui marche mal — une app générée par une IA qui plante, ou un vieux code que plus personne ne veut toucher. Je regarde ce qu'il a, puis je le répare ou je le refais à neuf.",
    en: "You already have something that works badly — an AI-generated app that keeps crashing, or old code nobody wants to touch anymore. I look at what's wrong, then fix it or bring it up to date.",
  },
}

const PAPERASSE_FIELDS: FieldDef[] = [
  {
    id: 'whatGetsRebuilt',
    type: 'textarea',
    rows: 3,
    label: {
      fr: "Qu'est-ce que tu reconstruis chaque semaine (ou chaque mois)?",
      en: 'What do you reconstruct every week (or every month)?',
    },
    placeholder: {
      fr: 'Ex : facture clients, suivi des heures, état de paie pour 4 employés, rapports TPS/TVQ, soumissions répétitives, relevés de fin de mois...',
      en: 'Ex: client invoices, hours tracking, payroll for 4 employees, GST/QST reports, repetitive quotes, end-of-month statements...',
    },
    required: true,
  },
  {
    id: 'currentMethod',
    type: 'radio',
    label: {
      fr: "Comment tu fais ça aujourd'hui?",
      en: 'How do you do it today?',
    },
    options: [
      { value: 'paper', label: { fr: 'Papier ou tête', en: 'Paper or memory' } },
      { value: 'excel', label: { fr: 'Excel ou Google Sheets', en: 'Excel or Google Sheets' } },
      { value: 'app', label: { fr: "Une app que je n'aime pas", en: "An app I don't like" } },
      { value: 'mix', label: { fr: 'Un mélange des trois', en: 'A mix of the three' } },
    ],
    required: true,
  },
  {
    id: 'frequency',
    type: 'select',
    label: { fr: 'À quelle fréquence?', en: 'How often?' },
    options: [
      { value: 'daily', label: { fr: 'Tous les jours', en: 'Every day' } },
      { value: 'weekly', label: { fr: 'Chaque semaine', en: 'Every week' } },
      { value: 'monthly', label: { fr: 'Chaque mois', en: 'Every month' } },
      { value: 'sporadic', label: { fr: 'Quand ça arrive', en: 'When it comes up' } },
    ],
    required: true,
  },
  {
    id: 'painPoint',
    type: 'textarea',
    rows: 3,
    label: {
      fr: 'Le moment qui te fait dire « il faut que ça change »?',
      en: "The moment that makes you say 'this has to change'?",
    },
    placeholder: {
      fr: "Ex : le dimanche soir à 22h en train de retrouver mes notes, ou la facture qu'on oublie d'envoyer pendant 3 mois, ou recopier les mêmes données dans 3 endroits différents...",
      en: 'Ex: Sunday night at 10pm digging through my notes, or the invoice we forget to send for 3 months, or retyping the same data in 3 different places...',
    },
    required: true,
  },
  {
    id: 'idealOutcome',
    type: 'textarea',
    rows: 3,
    label: {
      fr: "À quoi ça ressemblerait, l'idéal? (en une phrase)",
      en: 'What would the ideal look like? (in one sentence)',
    },
    placeholder: {
      fr: 'Ex : un bouton qui sort la facture en PDF, ou un fichier toujours à jour pour la comptable, ou plus jamais y penser le dimanche soir...',
      en: "Ex: a button that spits out the PDF invoice, or a file that's always up-to-date for the accountant, or never thinking about it on Sunday night again...",
    },
    required: true,
    hint: {
      fr: "Pas besoin de techno — décris juste l'effet.",
      en: 'No tech needed — just describe the effect.',
    },
  },
]

const SUIVI_FIELDS: FieldDef[] = [
  {
    id: 'whatTracked',
    type: 'textarea',
    rows: 3,
    label: {
      fr: "Qu'est-ce que tu suis exactement?",
      en: 'What exactly are you tracking?',
    },
    placeholder: {
      fr: "Ex : 40 clients, ce qu'on leur a livré, ce qu'ils nous doivent, l'état de l'inventaire qui bouge chaque jour, les projets en cours et qui s'occupe de quoi...",
      en: "Ex: 40 clients, what we delivered to them, what they owe us, inventory levels that shift every day, ongoing projects and who's on each...",
    },
    required: true,
  },
  {
    id: 'recordCount',
    type: 'select',
    label: { fr: "Combien d'entrées environ?", en: 'How many entries roughly?' },
    options: [
      { value: 'tens', label: { fr: 'Quelques dizaines', en: 'A few dozen' } },
      { value: 'hundreds', label: { fr: 'Quelques centaines', en: 'A few hundred' } },
      { value: 'thousands', label: { fr: 'Plus que 1000', en: 'More than 1000' } },
      { value: 'unknown', label: { fr: 'Aucune idée', en: 'No idea' } },
    ],
    required: true,
  },
  {
    id: 'currentSource',
    type: 'textarea',
    rows: 2,
    label: {
      fr: "Où sont les données aujourd'hui?",
      en: 'Where is the data today?',
    },
    placeholder: {
      fr: 'Ex : un Excel sur mon bureau, un autre dans le drive, un cahier au comptoir, des post-its, et le reste dans ma tête...',
      en: 'Ex: one Excel on my desk, another on the drive, a notebook at the counter, sticky notes, and the rest in my head...',
    },
    required: true,
  },
  {
    id: 'painPoint',
    type: 'textarea',
    rows: 3,
    label: {
      fr: "Qu'est-ce qui ne marche plus?",
      en: "What isn't working anymore?",
    },
    placeholder: {
      fr: 'Ex : on perd des clients dans les craques, le fichier crashe quand on est plusieurs dedans, je suis le seul à comprendre comment ça marche, on rappelle des gens deux fois...',
      en: "Ex: clients fall through the cracks, the file crashes when several of us are in it, I'm the only one who understands how it works, we call people back twice...",
    },
    required: true,
  },
  {
    id: 'idealOutcome',
    type: 'textarea',
    rows: 3,
    label: {
      fr: "À quoi ça ressemblerait, l'idéal? (en une phrase)",
      en: 'What would the ideal look like? (in one sentence)',
    },
    placeholder: {
      fr: 'Ex : tout le monde voit la même chose en temps réel, je peux répondre « où on est rendu? » en 5 secondes, plus jamais perdre une info...',
      en: "Ex: everyone sees the same thing in real time, I can answer 'where are we at?' in 5 seconds, never losing info again...",
    },
    required: true,
  },
]

const COORDINATION_FIELDS: FieldDef[] = [
  {
    id: 'whatCoordinated',
    type: 'textarea',
    rows: 3,
    label: {
      fr: "Qu'est-ce qui doit être coordonné?",
      en: 'What needs to be coordinated?',
    },
    placeholder: {
      fr: "Ex : rotation de pelletage de la rue, plan d'événement, équipe de bénévoles, horaire d'arrosage du potager communautaire, comité de parents, ligue de hockey amicale...",
      en: "Ex: street snow-shoveling rotation, event plan, volunteer team, community garden watering schedule, parents' committee, friendly hockey league...",
    },
    required: true,
  },
  {
    id: 'groupSize',
    type: 'select',
    label: { fr: 'Combien de personnes impliquées?', en: 'How many people involved?' },
    options: [
      { value: 'few', label: { fr: '2 à 5', en: '2 to 5' } },
      { value: 'small', label: { fr: '6 à 15', en: '6 to 15' } },
      { value: 'medium', label: { fr: '16 à 50', en: '16 to 50' } },
      { value: 'big', label: { fr: '50+', en: '50+' } },
    ],
    required: true,
  },
  {
    id: 'currentMethod',
    type: 'textarea',
    rows: 2,
    label: {
      fr: "Comment ça se décide aujourd'hui? (groupe Facebook, texto, en personne...)",
      en: 'How is it decided today? (Facebook group, texting, in person...)',
    },
    placeholder: {
      fr: "Ex : un groupe Facebook qui scrolle trop vite, un fil de texto à 12 personnes, on s'organise sur le perron le samedi matin, un courriel chaîne qu'on perd...",
      en: 'Ex: a Facebook group that scrolls too fast, a text thread with 12 people, we sort it out on the front porch Saturday morning, a chain email that gets lost...',
    },
    required: true,
  },
  {
    id: 'frequency',
    type: 'select',
    label: { fr: 'À quelle fréquence ça revient?', en: 'How often does it come up?' },
    options: [
      { value: 'weekly', label: { fr: 'Chaque semaine', en: 'Every week' } },
      { value: 'monthly', label: { fr: 'Chaque mois', en: 'Every month' } },
      { value: 'seasonal', label: { fr: 'Saisonnier', en: 'Seasonal' } },
      { value: 'occasional', label: { fr: 'Quand ça adonne', en: 'When it comes up' } },
    ],
    required: true,
  },
  {
    id: 'idealOutcome',
    type: 'textarea',
    rows: 3,
    label: {
      fr: "À quoi ça ressemblerait, l'idéal? (en une phrase)",
      en: 'What would the ideal look like? (in one sentence)',
    },
    placeholder: {
      fr: "Ex : chacun sait son tour sans qu'on ait à le redire, on voit l'horaire d'un coup d'œil, plus de doublon ni d'oubli, les nouveaux comprennent en 30 secondes...",
      en: 'Ex: everyone knows their turn without us having to repeat it, the schedule is visible at a glance, no more duplicates or misses, newcomers get it in 30 seconds...',
    },
    required: true,
  },
]

const AUTRE_FIELDS: FieldDef[] = [
  {
    id: 'description',
    type: 'textarea',
    rows: 6,
    label: {
      fr: "Décris ton problème dans tes mots — pas besoin d'être organisé",
      en: 'Describe your problem in your own words — no need to be organized',
    },
    placeholder: {
      fr: "Ex : raconte-moi le dernier moment où ça t'a tapé sur les nerfs. Pas besoin d'être technique — dis-le comme tu le dirais à un ami au café. Ça peut être long ou court, brouillon ou clair, ça me va.",
      en: "Ex: tell me about the last time it got on your nerves. No need to be technical — say it like you'd tell a friend at the café. Long or short, messy or clean, that's fine.",
    },
    required: true,
  },
  {
    id: 'whoFeelsIt',
    type: 'textarea',
    rows: 2,
    label: {
      fr: "Qui ressent le problème? Toi seulement, ou d'autres aussi?",
      en: 'Who feels the problem? Just you, or others too?',
    },
    placeholder: {
      fr: "Ex : moi seul, mon associé aussi, toute l'équipe, mes clients quand ils appellent, les bénévoles qui abandonnent...",
      en: 'Ex: just me, my partner too, the whole team, my clients when they call, volunteers who give up...',
    },
    required: true,
  },
  {
    id: 'whatTried',
    type: 'textarea',
    rows: 3,
    label: {
      fr: "Qu'est-ce que tu as déjà essayé?",
      en: 'What have you already tried?',
    },
    placeholder: {
      fr: "Ex : un Excel qui a vieilli, une app abandonnée après 2 mois, demander à mon neveu, un consultant qui a livré quelque chose qu'on n'utilise pas, rien encore...",
      en: 'Ex: an Excel that aged out, an app abandoned after 2 months, asking my nephew, a consultant who delivered something we never use, nothing yet...',
    },
    required: false,
  },
]

// Rescue is the one intake type pointed at something that *already exists*
// rather than a problem to solve fresh. The first field (rescueKind) is the
// discriminator: AI-generated slop to clean up vs. a real codebase to
// modernize — two different jobs, and Marc triages them differently. The
// remaining fields are written to serve both cases.
const RESCUE_FIELDS: FieldDef[] = [
  {
    id: 'rescueKind',
    type: 'radio',
    label: {
      fr: "C'est quoi, au juste?",
      en: 'What is it, exactly?',
    },
    options: [
      {
        value: 'ai-build',
        label: {
          fr: "Une app que j'ai générée avec une IA ou un outil no-code",
          en: 'An app I generated with an AI or no-code tool',
        },
      },
      {
        value: 'codebase',
        label: {
          fr: "Un vrai code source qui existe déjà (vieux site, app, projet laissé par quelqu'un)",
          en: 'A real codebase that already exists (an old site, an app, a project someone left behind)',
        },
      },
    ],
    required: true,
    hint: {
      fr: "Ça m'aide à savoir dans quoi je m'embarque : nettoyer une app générée par une IA et moderniser du vrai code, c'est deux jobs pas mal différentes.",
      en: "It tells me what I'm walking into — cleaning up AI-generated output and modernizing a real codebase are two different jobs.",
    },
  },
  {
    id: 'builtWith',
    type: 'text',
    label: {
      fr: "C'est bâti avec quoi, autant que tu saches?",
      en: "What's it built with, as far as you know?",
    },
    placeholder: {
      fr: 'Ex : Lovable, Bolt, Bubble... ou React, un vieux WordPress, du PHP de 2015.',
      en: 'Ex: Lovable, Bolt, Bubble... or React, an old WordPress, PHP from 2015.',
    },
    required: true,
    hint: {
      fr: "Pas sûr? Nomme juste l'outil que tu as utilisé, ou écris « aucune idée ».",
      en: "Not sure? Just name the tool you used, or write 'no idea.'",
    },
  },
  {
    id: 'whereItLives',
    type: 'textarea',
    rows: 3,
    label: {
      fr: 'Où ça vit, et comment je fais pour entrer?',
      en: 'Where does it live, and how do I get in?',
    },
    placeholder: {
      fr: "Ex : un lien vers l'app, un dépôt GitHub, un fichier exporté. Et comment entrer — un login, une invitation, un zip à m'envoyer.",
      en: 'Ex: a link to the app, a GitHub repo, an exported file. And how to get in — a login, an invite, a zip to send me.',
    },
    required: true,
  },
  {
    id: 'whatsBroken',
    type: 'textarea',
    rows: 3,
    label: {
      fr: "Qu'est-ce qui ne marche pas, ou qui manque?",
      en: "What's broken, or what's missing?",
    },
    placeholder: {
      fr: "Ex : ça plante quand plusieurs personnes l'utilisent, les données se perdent, je suis bloqué sur la seule fonction qu'il me faut, personne ne sait l'héberger, le dev d'avant a disparu.",
      en: "Ex: it crashes when several people use it, the data vanishes, I'm stuck on the one feature I need, nobody can host it, the previous dev disappeared.",
    },
    required: true,
  },
  {
    id: 'inUse',
    type: 'select',
    label: {
      fr: "Est-ce que quelqu'un l'utilise en ce moment?",
      en: 'Is anyone using it right now?',
    },
    options: [
      {
        value: 'live',
        label: { fr: "Oui, c'est en ligne pour de vrai", en: "Yes, it's genuinely live" },
      },
      {
        value: 'halfway',
        label: { fr: 'À moitié — ça marche par bouts', en: 'Halfway — it works in patches' },
      },
      {
        value: 'never',
        label: { fr: "Non, ça n'a jamais vraiment marché", en: 'No, it never really worked' },
      },
      {
        value: 'prototype',
        label: {
          fr: "C'est juste un prototype ou un essai",
          en: "It's just a prototype or a test",
        },
      },
    ],
    required: true,
  },
  {
    id: 'idealOutcome',
    type: 'textarea',
    rows: 3,
    label: {
      fr: '« Réparé », ça ressemble à quoi? (en une phrase)',
      en: "What does 'fixed' look like? (in one sentence)",
    },
    placeholder: {
      fr: "Ex : ça tient quand 10 personnes l'utilisent, je peux ajouter mes affaires sans tout casser, c'est à moi et hébergé pour de bon.",
      en: "Ex: it holds up when 10 people use it, I can add my own things without breaking it, it's mine and hosted for good.",
    },
    required: true,
    hint: {
      fr: "Pas besoin de techno — décris juste l'effet.",
      en: 'No tech needed — just describe the effect.',
    },
  },
]

export const SCHEMAS: Record<ProblemType, IntakeSchema> = {
  paperasse: {
    type: 'paperasse',
    title: TYPE_TITLES.paperasse,
    description: TYPE_DESCRIPTIONS.paperasse,
    fields: PAPERASSE_FIELDS,
  },
  suivi: {
    type: 'suivi',
    title: TYPE_TITLES.suivi,
    description: TYPE_DESCRIPTIONS.suivi,
    fields: SUIVI_FIELDS,
  },
  coordination: {
    type: 'coordination',
    title: TYPE_TITLES.coordination,
    description: TYPE_DESCRIPTIONS.coordination,
    fields: COORDINATION_FIELDS,
  },
  autre: {
    type: 'autre',
    title: TYPE_TITLES.autre,
    description: TYPE_DESCRIPTIONS.autre,
    fields: AUTRE_FIELDS,
  },
  rescue: {
    type: 'rescue',
    title: TYPE_TITLES.rescue,
    description: TYPE_DESCRIPTIONS.rescue,
    fields: RESCUE_FIELDS,
  },
}

export function getSchemaForType(type: ProblemType): IntakeSchema {
  return SCHEMAS[type]
}

export function localized<T extends { fr: string; en: string }>(
  obj: T | undefined,
  lang: Lang,
): string {
  if (!obj) return ''
  return obj[lang] ?? obj.fr
}
