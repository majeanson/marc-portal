export type Lang = 'fr' | 'en'

export type Copy = typeof FR

const FR = {
  langCode: 'fr-CA',
  langSwitchLabel: 'EN',
  langSwitchHref: '/en',

  skipToContent: 'Aller au contenu principal',
  langNavLabel: 'Choix de langue',

  brandTitle: 'Marc — dev à Québec',
  metaDescription:
    "Marc, dev à Québec. Soir et fin de semaine, j'aide les gens à régler des problèmes du quotidien avec des petits logiciels. Async, à ton rythme.",

  hero: {
    eyebrow: 'side-pratique · Québec · async',
    salut: 'Salut, c’est Marc, dev à Québec.',
    body1:
      'Job de jour le jour. Le soir et la fin de semaine, j’aide les gens à régler des problèmes du quotidien. En async, à ton rythme et au mien — pas de calls, pas de meetings.',
    body2:
      'Tu as un problème répétitif — paperasse, suivi, coordination, n’importe quoi du genre? Décris-le-moi via mon portail.',
    body3:
      'Compte gratuit. Démos testables tout le long du projet. Premier brouillon en quelques jours.',
    cta: 'Crée ton compte gratuit →',
    ctaWaitlist: 'Rejoindre la liste d’attente →',
    ctaLoggedIn: 'Démarrer une nouvelle proposition →',
    mySessionsLink: 'Voir mes sessions',
    bilingual: '(Disponible aussi en anglais — réponse dans ta langue.)',
  },

  how: {
    eyebrow: '04 étapes',
    title: 'Comment ça marche',
    steps: [
      {
        num: '01',
        title: 'Tu décris ton problème',
        body: 'Formulaire guidé. Pas un call. Sauvegarde automatique. Tu reviens quand tu veux.',
      },
      {
        num: '02',
        title: 'Je te réponds en 72 h',
        body: 'Oui, non, ou « raconte-moi plus ». Je lis chaque formulaire moi-même — pas d’IA entre toi et moi.',
      },
      {
        num: '03',
        title: 'Tu suis le travail en direct',
        body: 'Démo testable dès le 2e jour. Pas de réunion de mise à jour — tout vit dans le portail.',
      },
      {
        num: '04',
        title: 'On livre',
        body: 'Le projet devient une page publique (avec une option pour cacher tes données commerciales). Une ronde de retouches incluse.',
      },
    ],
  },

  demo: {
    eyebrow: 'démo principale',
    title: 'À quoi ça ressemble',
    sub: 'Sunday Night Dread — voix → brouillon de facture, pour les gens de métier.',
    body: 'Pendant la semaine, le plombier dicte des notes vocales depuis son truck — matériaux, heures, clients. Le dimanche matin, un brouillon de facture l’attend dans son inbox. Plus de paperasse à 22h le dimanche soir.',
    cta: 'Tester la démo →',
    disclosure:
      'Voix client composite — basée sur des conversations réelles avec 3 gens de métier. Le code et l’app sont vrais et déployés.',
    tag: 'Tier 2 · ≈ $1500 · livré en 3 semaines',
  },

  showcases: {
    eyebrow: 'projets livrés',
    title: 'Ce qui a été livré',
    body: 'Chaque projet livré devient une page publique. Tu vois le tier, le prix, et les heures réelles. Le mur grandit chaque mois.',
    seeAll: 'Voir tous les projets →',
    filterTier: 'tier',
    filterStatus: 'statut',
    filterAll: 'tous',
    empty: 'Aucun projet ne correspond à ces filtres.',
  },

  vibe: {
    eyebrow: 'attrape mon vibe',
    title: 'Ce qu’on fait, ce qu’on ne fait pas',
    body: 'Lis cette liste avant de remplir le formulaire. Si ça matche, on va bien s’entendre. Sinon, pas de drame — y a plein d’autres devs qui font autre chose.',
    do: {
      title: 'On fait',
      items: [
        'Automatisation de paperasse répétitive',
        'Coordination de petites équipes ou de bénévoles',
        'Voix → document, voix → facture',
        'Suivi clients, inventaire simple',
        'Petits outils internes qui doivent durer 2-3 ans',
      ],
    },
    dont: {
      title: 'On ne fait pas',
      items: [
        'Calls, meetings, vidéos planifiées',
        'Bug fixes urgents ou support 24/7',
        'Changements de scope en cours de projet',
        'Hosting de longue durée ou maintenance',
        'Apps temps-réel (chat, booking, dashboards minute-par-minute)',
      ],
    },
  },

  pricing: {
    eyebrow: 'prix publics',
    title: 'Combien ça coûte',
    body: 'Prix concrets, pas « contactez-nous ». Chaque tier renvoie à des projets réels du même tier — tu vois ce que ça donne avant de soumettre.',
    tiers: [
      {
        name: 'Tier 0',
        price: 'Gratuit',
        scope:
          'Ton problème est trop petit pour engager un dev. Je te redirige vers un patron similaire ou un template no-code.',
        after: 'auto-service',
      },
      {
        name: 'Tier 1',
        price: '≈ $300',
        scope:
          'Projet d’une demi-journée. Petit script, automatisation simple, formulaire qui marche.',
        after: '0 retouches après livraison',
      },
      {
        name: 'Tier 2',
        price: '≈ $1500',
        scope: 'Projet d’1-3 semaines. Outil interne qui dure. La démo Sunday Night Dread est ici.',
        after: '1 ronde de retouches incluse',
        anchor: true,
      },
      {
        name: 'Tier 3',
        price: '≈ $3000+',
        scope:
          'Projet plus gros. Sur devis après triage. Toujours scopé pour livrer en moins de 6 semaines.',
        after: 'devis post-triage',
      },
    ],
  },

  cta: {
    eyebrow: 'prêt?',
    title: 'Décris ton problème',
    body: 'Compte gratuit. Aucun call. Je lis chaque formulaire moi-même et je te réponds en 72 h — oui, non, ou « raconte-moi plus ».',
    button: 'Ouvrir le formulaire →',
    buttonLoggedIn: 'Démarrer une nouvelle proposition →',
    micro:
      'Si je suis plein, tu peux quand même créer un compte et te mettre sur la liste d’attente.',
  },

  about: {
    eyebrow: 'qui je suis',
    title: 'À propos',
    body: 'Je suis dev senior depuis ~10 ans. Job de jour à temps plein (37,5 h/sem), une famille, et l’envie d’aider les petites entreprises et les gens autour de moi à se simplifier la vie sans payer une agence. Le portail est l’architecture qui rend tout ça possible — pour toi comme pour moi.',
    body2:
      'Pas une agence. Pas une plateforme. Un humain dans le siège du jugement, et un peu de machine au milieu pour qu’on respecte tous les deux nos soirs et nos fins de semaine.',
  },

  footer: {
    contact: 'Contact : via le portail uniquement (pas d’email, pas de téléphone).',
    legal: 'Hébergé au Canada · Loi 25 · OQLF',
    copyright: '© Marc 2026',
  },

  showcase: {
    backToWall: '← Retour aux projets',
    statusDraft: 'Brouillon — projet en construction',
    statusActive: 'En cours — démo testable bientôt',
    statusFrozen: 'Livré',
    statusDeprecated: 'Archivé',
    targetShip: 'Livraison cible',
    shippedOn: 'Livré le',
    livePreviewTitle: 'Démo en direct',
    livePreviewPending: 'L’app n’est pas encore déployée. Cible : {date}. La démo apparaîtra ici.',
    livePreviewIframeTitle: 'Démo de cette page de projet',
    timelineTitle: 'Le déroulement de l’engagement',
    timelinePending: 'À venir',
    decisionsTitle: 'Décisions prises en cours de route',
    sourceTitle: 'Source',
    sourcePending: 'Source publiée à la livraison',
    nextIterTitle: 'Prochaines itérations (hors scope du MVP)',
    composite: 'Voix client composite',
    notFoundTitle: 'Projet introuvable',
    notFoundBody:
      'Cette adresse ne correspond à aucun projet. Le projet a peut-être été retiré, ou le lien est incorrect.',
    stageLabels: {
      intake: 'Intake',
      triage: 'Triage',
      plan: 'Plan',
      build: 'Construction',
      review: 'Revue',
      shipped: 'Livré',
    },
    lifecycle: {
      label: 'Cycle de vie de la fonctionnalité',
      today: 'aujourd’hui',
      stages: {
        draft: 'Brouillon',
        active: 'Actif',
        frozen: 'Figé',
      },
    },
    revisionLog: {
      title: 'Historique des révisions',
      summary: 'Voir les {n} révisions de cette fonctionnalité',
      viewBuild: 'Voir ce build →',
      hideBuild: 'Cacher le build',
      buildHint: 'Aperçu réel du déploiement à cette révision. Servi depuis Cloudflare Pages.',
      commitLabel: 'commit',
    },
  },

  engagement: {
    statusBarLabel: "Étape de l'engagement",
    demoNotice: 'EXEMPLE — engagement en cours',
    startedOn: 'commencé le',
    backHome: "← Retour à l'accueil",
    stages: {
      triage: 'Triage',
      planning: 'Plan',
      building: 'Construction',
      review: 'Revue',
      shipped: 'Livré',
    },
    preview: {
      title: 'Aperçu testable',
      iframeTitle: 'Aperçu en direct du livrable',
      notDeployedYet:
        "Pas encore déployé — l'aperçu apparaîtra ici dès le jour 5 (engagement type Tier 2).",
    },
    thread: {
      title: "Le fil de l'engagement",
      body: "Pas d'email, pas de meetings. Toute la communication vit ici, en ordre chronologique.",
      label: 'Messages chronologiques entre Marc et le client',
      authors: { marc: 'Marc', client: 'Client', system: 'Système' },
      types: {
        update: 'mise à jour',
        decision: 'décision',
        question: 'question',
        system: 'système',
      },
    },
    relatedShowcase: 'Page publique de ce projet',
    viewShowcase: 'Voir la page publique',
    notFound: {
      title: 'Engagement introuvable',
      body: "Cette URL ne correspond à aucun engagement public. Si tu es un client, vérifie ton lien — sinon, retour à l'accueil.",
    },
  },

  tier0: {
    pageTitle: 'Tier 0 — outils gratuits pour problèmes plus petits',
    metaDescription:
      "Patrons gratuits pour les problèmes du quotidien trop petits pour engager un dev : rotation de pelletage, RSVP, suivi d'heures, prêts entre voisins.",
    backHome: "← Retour à l'accueil",
    eyebrow: 'Tier 0 · auto-service · gratuit',
    title: 'Ton problème est trop petit pour engager un dev — voici comment le régler toi-même',
    intro:
      "Pas de honte. Si ton budget est sous $200 et que ton problème cadre dans une de ces 4 catégories, voici la formule. Tu n'as besoin de rien acheter et tu n'as pas besoin de moi.",
    principle:
      "Principe : la bonne solution pour un problème de $50 est gratuite. Si ton problème grandit (5+ employés, plusieurs équipes, données critiques), reviens me voir — c'est là que je vaux mon prix.",
    problemLabel: 'Le problème',
    recipeLabel: 'La recette',
    growBack:
      "Si un de ces patrons ne suffit plus, c'est que ton problème a grandi. Bonne nouvelle, c'est probablement Tier 1 ou 2 maintenant — décris-moi ça.",
    intakeCta: 'Mon problème a grandi → ouvrir le formulaire',
  },

  sndDemo: {
    pageTitle: 'Démo Sunday Night Dread',
    eyebrow: 'démo · voix → brouillon de facture',
    title: 'Sunday Night Dread',
    intro:
      "Pendant la semaine, tu dictes des notes vocales depuis ton truck. Ici tu peux 'jouer' 3 notes composites pour voir comment elles deviennent un brouillon de facture le dimanche matin.",
    clipsTitle: '1. Notes vocales de la semaine',
    clipsHint: "Clique pour 'jouer' chaque note. Tu peux en jouer une, deux ou les trois.",
    transcriptLabel: 'Transcription',
    atClient: 'chez {name}',
    parsedTitle: '2. Ce que le système extrait',
    parsedHint:
      'Texte libre + lexique de chantier québécois. Pas de listes déroulantes. Le parser identifie le client, les heures, les matériaux.',
    invoiceTitle: '3. Brouillon de facture',
    invoiceHint:
      'Le dimanche matin, un brouillon arrive dans ta boîte de réception (pas une nouvelle app). TPS + TVQ calculées. À toi de réviser et envoyer.',
    generate: 'Générer le brouillon de facture →',
    emailFrom: 'De: marc.portal@example.qc.ca',
    emailTo: 'Pour: toi (brouillon)',
    emailSubject: 'Sujet: Brouillon de facture — semaine — {client}',
    invoiceGreeting: 'Brouillon de facture pour {client}',
    invoiceLead: "Voici ce qui a été dicté cette semaine. Révise les chiffres avant d'envoyer.",
    col_desc: 'Description',
    col_qty: 'Qté',
    col_unit: 'Prix unitaire',
    col_total: 'Total',
    laborRow: "Main-d'œuvre (taux ${rate}/h)",
    subtotal: 'Sous-total',
    total: 'Total',
    invoiceSign: '— Brouillon généré · à réviser et envoyer manuellement.',
    buildLogTitle: 'Journal de construction',
    buildLogHint:
      'Cette démo est documentée comme une fonctionnalité réelle — chaque révision est inscrite ici, lisible, datée.',
    disclaimer:
      'Démo statique avec voix-clients composites. Le code et le parser sont vrais. Aucune donnée réelle, aucun email envoyé.',
  },

  intake: {
    pageTitle: 'Décris ton problème — formulaire',
    metaDescription:
      "Formulaire d'intake pour la pratique-side de Marc. Async, à ton rythme. Sauvegarde automatique. Réponse en 72h.",
    backHome: "← Retour à l'accueil",
    capacity: {
      atCap:
        "Je suis présentement plein. Tu peux quand même soumettre ton formulaire — je te placerai sur la liste d'attente et je te répondrai quand un slot ouvre.",
    },
    steps: {
      vibe: 'On se comprend',
      account: 'Compte',
      type: 'Type',
      form: 'Détails',
      confirmation: 'Reçu',
    },
    vibe: {
      eyebrow: 'avant tout',
      confirm: "J'ai lu, ça matche, je continue.",
      cta: 'Continuer →',
    },
    account: {
      eyebrow: 'compte gratuit',
      title: "On a besoin d'une adresse courriel",
      body: "C'est tout. Pas de mot de passe pendant que tu remplis. Si tu reviens plus tard, je t'envoie un lien magique pour reprendre. Le brouillon est sauvegardé automatiquement à chaque champ.",
      emailLabel: 'Courriel',
      nameLabel: 'Ton prénom (optionnel)',
      namePlaceholder: 'Marie',
      hint: 'Marc lit chaque formulaire lui-même. Aucun spam, aucune liste, aucune revente.',
      cta: 'Continuer →',
      alreadyHaveAccount: 'Tu as déjà un compte ?',
      signIn: 'Connecte-toi →',
    },
    typePicker: {
      eyebrow: 'quel genre de problème',
      title: 'Quel genre de problème?',
      body: 'Choisis celui qui se rapproche le plus. Si rien ne colle, prends « autre » — Marc lira en personne et redirigera au besoin.',
    },
    form: {
      eyebrow: 'le détail',
      autosaved: '✓ Sauvegardé automatiquement à chaque champ',
      back: '← Changer de type',
      continue: 'Soumettre →',
    },
    confirmation: {
      eyebrowAccepted: 'reçu',
      eyebrowWaitlist: "reçu — liste d'attente",
      titleAccepted: "Merci, c'est reçu.",
      titleWaitlist: "Merci, tu es sur la liste d'attente.",
      bodyAccepted:
        "Je lis chaque formulaire moi-même — pas d'IA entre toi et moi. Tu auras une réponse honnête (oui, non, ou « raconte-moi plus ») dans les 72 prochaines heures, par courriel.",
      bodyWaitlist:
        "Je suis présentement plein (1 projet actif + 1 en triage, c'est mon plafond pour respecter ma famille). Je te réponds dès qu'un slot ouvre — généralement quelques semaines. Le brouillon reste sauvegardé.",
      sla: 'Réponse honnête en 72 h — oui, non, ou « raconte-moi plus ».',
      summaryTitle: "Ce que tu m'as envoyé",
      summaryEmail: 'Courriel',
      summaryName: 'Prénom',
      summaryType: 'Type de problème',
      summarySubmittedAt: 'Soumis le',
      summaryAnswers: 'Tes réponses',
      startOver: 'Recommencer un nouveau formulaire',
      submitting: 'Envoi en cours…',
      submitError:
        'Hmm, problème de connexion en envoyant ton intake. Ton brouillon est sauvegardé — réessaie dans un instant.',
      sessionLinkLabel: 'Voir ta session →',
      sessionLinkHint: 'Ta proposition est enregistrée. Tu peux la suivre et y répondre ici.',
      magicLinkSentTitle: 'Vérifie ton courriel pour finaliser',
      magicLinkSentBody: (email: string) =>
        `On a envoyé un lien de connexion à ${email}. Ouvre-le pour accéder à ta session — il expire dans 30 minutes.`,
      magicLinkAgain: 'Pas reçu ? Renvoyer le lien',
    },
  },
}

const EN: Copy = {
  langCode: 'en-CA',
  langSwitchLabel: 'FR',
  langSwitchHref: '/',

  skipToContent: 'Skip to main content',
  langNavLabel: 'Language selection',

  brandTitle: 'Marc — dev in Quebec City',
  metaDescription:
    'Marc, a dev in Quebec City. Evenings and weekends, I help people solve everyday problems with small software. Async, at your pace.',

  hero: {
    eyebrow: 'side-practice · Quebec · async',
    salut: "Hi, I'm Marc, a dev in Quebec City.",
    body1:
      'Day job during the week. Evenings and weekends, I help people solve everyday problems. Async, at your pace and mine — no calls, no meetings.',
    body2:
      'Got a recurring problem — paperwork, tracking, coordination, anything along those lines? Tell me about it through the portal.',
    body3: 'Free account. Live demos testable throughout the project. First draft in a few days.',
    cta: 'Create a free account →',
    ctaWaitlist: 'Join the waitlist →',
    ctaLoggedIn: 'Start a new proposal →',
    mySessionsLink: 'View my sessions',
    bilingual: '(Also available in French — reply in your language.)',
  },

  how: {
    eyebrow: '04 steps',
    title: 'How it works',
    steps: [
      {
        num: '01',
        title: 'You describe your problem',
        body: 'Guided form. Not a call. Auto-save. Come back whenever.',
      },
      {
        num: '02',
        title: 'I reply within 72h',
        body: "Yes, no, or 'tell me more.' I read every form myself — no AI between you and me.",
      },
      {
        num: '03',
        title: 'You watch the work live',
        body: 'Testable demo from day 2. No status meetings — everything lives in the portal.',
      },
      {
        num: '04',
        title: 'We ship',
        body: 'The project becomes a public page (with an option to redact your commercial data). One round of post-ship tweaks included.',
      },
    ],
  },

  demo: {
    eyebrow: 'main demo',
    title: "Here's what it looks like",
    sub: 'Sunday Night Dread — voice → draft invoice, for tradespeople.',
    body: 'During the week, the plumber dictates voice notes from the truck — materials, hours, clients. Sunday morning, a draft invoice is waiting in the inbox. No more 10pm Sunday paperwork.',
    cta: 'Try the demo →',
    disclosure:
      'Composite client voice — drawn from real conversations with 3 tradespeople. The code and the app are real and deployed.',
    tag: 'Tier 2 · ≈ $1500 · shipped in 3 weeks',
  },

  showcases: {
    eyebrow: 'shipped projects',
    title: "What's been shipped",
    body: 'Every shipped project becomes a public page. You see the tier, the price, the actual hours. The wall grows every month.',
    seeAll: 'See all projects →',
    filterTier: 'tier',
    filterStatus: 'status',
    filterAll: 'all',
    empty: 'No projects match these filters.',
  },

  vibe: {
    eyebrow: 'catch the vibe',
    title: 'What we do, what we don’t',
    body: "Read this before filling out the form. If it matches, we'll get along. If not, no drama — there are plenty of other devs who do other things.",
    do: {
      title: 'We do',
      items: [
        'Repetitive paperwork automation',
        'Coordination for small teams or volunteers',
        'Voice → document, voice → invoice',
        'Client tracking, simple inventory',
        'Small internal tools that need to last 2-3 years',
      ],
    },
    dont: {
      title: "We don't",
      items: [
        'Calls, meetings, scheduled video',
        'Urgent bug fixes or 24/7 support',
        'Mid-build scope changes',
        'Long-term hosting or maintenance',
        'Real-time apps (chat, booking, minute-by-minute dashboards)',
      ],
    },
  },

  pricing: {
    eyebrow: 'public pricing',
    title: 'What it costs',
    body: 'Concrete prices, no "contact us." Each tier links to actual past projects of the same tier — you see what it looks like before you submit.',
    tiers: [
      {
        name: 'Tier 0',
        price: 'Free',
        scope:
          'Your problem is too small to hire a dev. I redirect you to a similar pattern or a no-code template.',
        after: 'self-service',
      },
      {
        name: 'Tier 1',
        price: '≈ $300',
        scope: 'Half-day project. Small script, simple automation, a form that works.',
        after: '0 post-ship tweaks',
      },
      {
        name: 'Tier 2',
        price: '≈ $1500',
        scope: 'A 1-3 week project. An internal tool that lasts. Sunday Night Dread sits here.',
        after: '1 round of tweaks included',
        anchor: true,
      },
      {
        name: 'Tier 3',
        price: '≈ $3000+',
        scope:
          'Bigger project. Custom-quoted after triage. Always scoped to ship in under 6 weeks.',
        after: 'post-triage quote',
      },
    ],
  },

  cta: {
    eyebrow: 'ready?',
    title: 'Describe your problem',
    body: "Free account. No call. I read every form myself and reply within 72h — yes, no, or 'tell me more.'",
    button: 'Open the form →',
    buttonLoggedIn: 'Start a new proposal →',
    micro: "If I'm full, you can still create an account and join the waitlist.",
  },

  about: {
    eyebrow: 'who I am',
    title: 'About',
    body: "I've been a senior dev for ~10 years. Full-time day job (37.5h/week), a family, and a desire to help small businesses and people around me simplify their lives without paying an agency. The portal is the architecture that makes that possible — for both of us.",
    body2:
      'Not an agency. Not a platform. A human in the judgment seat, with a bit of machine in the middle so we both keep our evenings and weekends.',
  },

  footer: {
    contact: 'Contact: through the portal only (no email, no phone).',
    legal: 'Hosted in Canada · Bill 25 · OQLF',
    copyright: '© Marc 2026',
  },

  showcase: {
    backToWall: '← Back to projects',
    statusDraft: 'Draft — work in progress',
    statusActive: 'In progress — testable demo soon',
    statusFrozen: 'Shipped',
    statusDeprecated: 'Archived',
    targetShip: 'Target ship',
    shippedOn: 'Shipped on',
    livePreviewTitle: 'Live demo',
    livePreviewPending: "The app isn't deployed yet. Target: {date}. The demo will appear here.",
    livePreviewIframeTitle: 'Live demo for this project page',
    timelineTitle: 'How the engagement went',
    timelinePending: 'Upcoming',
    decisionsTitle: 'Decisions made along the way',
    sourceTitle: 'Source',
    sourcePending: 'Source published at ship',
    nextIterTitle: 'Next iterations (out of MVP scope)',
    composite: 'Composite client voice',
    notFoundTitle: 'Project not found',
    notFoundBody:
      "This URL doesn't match any project. It may have been removed, or the link is incorrect.",
    stageLabels: {
      intake: 'Intake',
      triage: 'Triage',
      plan: 'Plan',
      build: 'Build',
      review: 'Review',
      shipped: 'Shipped',
    },
    lifecycle: {
      label: 'Feature lifecycle',
      today: 'today',
      stages: {
        draft: 'Draft',
        active: 'Active',
        frozen: 'Frozen',
      },
    },
    revisionLog: {
      title: 'Revision history',
      summary: 'See {n} revisions of this feature',
      viewBuild: 'View this build →',
      hideBuild: 'Hide build',
      buildHint:
        'Live preview of the deployment as it shipped at this revision. Served from Cloudflare Pages.',
      commitLabel: 'commit',
    },
  },

  engagement: {
    statusBarLabel: 'Engagement stage',
    demoNotice: 'EXAMPLE — engagement in progress',
    startedOn: 'started on',
    backHome: '← Back home',
    stages: {
      triage: 'Triage',
      planning: 'Plan',
      building: 'Build',
      review: 'Review',
      shipped: 'Shipped',
    },
    preview: {
      title: 'Testable preview',
      iframeTitle: 'Live preview of the deliverable',
      notDeployedYet:
        'Not deployed yet — the preview appears here from day 5 (typical Tier 2 engagement).',
    },
    thread: {
      title: 'Engagement thread',
      body: 'No email, no meetings. All communication lives here, chronologically.',
      label: 'Chronological messages between Marc and the client',
      authors: { marc: 'Marc', client: 'Client', system: 'System' },
      types: {
        update: 'update',
        decision: 'decision',
        question: 'question',
        system: 'system',
      },
    },
    relatedShowcase: 'Public page for this project',
    viewShowcase: 'View public page',
    notFound: {
      title: 'Engagement not found',
      body: "This URL doesn't match any public engagement. If you're a client, check your link — otherwise, back to home.",
    },
  },

  tier0: {
    pageTitle: 'Tier 0 — free tools for smaller problems',
    metaDescription:
      'Free patterns for everyday problems too small to hire a dev: snow rotation, RSVP, hours tracking, neighbour lending.',
    backHome: '← Back home',
    eyebrow: 'Tier 0 · self-service · free',
    title: "Your problem is too small to hire a dev — here's how to handle it yourself",
    intro:
      "No shame. If your budget is under $200 and your problem fits one of these 4 categories, here's the formula. You don't need to buy anything and you don't need me.",
    principle:
      "Principle: the right solution for a $50 problem is free. If your problem grows (5+ employees, multiple teams, critical data), come back — that's where I earn my price.",
    problemLabel: 'The problem',
    recipeLabel: 'The recipe',
    growBack:
      "If one of these patterns isn't enough anymore, your problem grew. Good news — it's probably Tier 1 or 2 now. Tell me about it.",
    intakeCta: 'My problem grew → open the form',
  },

  sndDemo: {
    pageTitle: 'Sunday Night Dread demo',
    eyebrow: 'demo · voice → draft invoice',
    title: 'Sunday Night Dread',
    intro:
      "During the week you dictate voice notes from your truck. Here you can 'play' 3 composite notes to see how they become a draft invoice on Sunday morning.",
    clipsTitle: '1. Voice notes from the week',
    clipsHint: "Click to 'play' each note. You can play one, two, or all three.",
    transcriptLabel: 'Transcript',
    atClient: "at {name}'s",
    parsedTitle: '2. What the system extracts',
    parsedHint:
      'Free text + Quebec construction lexicon. No dropdowns. The parser identifies the client, hours, and materials.',
    invoiceTitle: '3. Draft invoice',
    invoiceHint:
      'Sunday morning, a draft lands in your inbox (not yet another app). GST + QST calculated. You review and send.',
    generate: 'Generate draft invoice →',
    emailFrom: 'From: marc.portal@example.qc.ca',
    emailTo: 'To: you (draft)',
    emailSubject: 'Subject: Draft invoice — week — {client}',
    invoiceGreeting: 'Draft invoice for {client}',
    invoiceLead: 'Here is what was dictated this week. Review the numbers before sending.',
    col_desc: 'Description',
    col_qty: 'Qty',
    col_unit: 'Unit price',
    col_total: 'Total',
    laborRow: 'Labor (rate ${rate}/h)',
    subtotal: 'Subtotal',
    total: 'Total',
    invoiceSign: '— Draft generated · review and send manually.',
    buildLogTitle: 'Build log',
    buildLogHint:
      'This demo is documented like a real feature — every revision is recorded here, readable, dated.',
    disclaimer:
      'Static demo with composite client voices. The code and parser are real. No real data, no email sent.',
  },

  intake: {
    pageTitle: 'Describe your problem — form',
    metaDescription:
      "Intake form for Marc's side-practice. Async, at your pace. Auto-save. Reply within 72h.",
    backHome: '← Back home',
    capacity: {
      atCap:
        "I'm currently full. You can still submit — I'll put you on the waitlist and reply when a slot opens.",
    },
    steps: {
      vibe: 'We agree',
      account: 'Account',
      type: 'Type',
      form: 'Details',
      confirmation: 'Received',
    },
    vibe: {
      eyebrow: 'first things first',
      confirm: "I've read it, it matches, I want to continue.",
      cta: 'Continue →',
    },
    account: {
      eyebrow: 'free account',
      title: 'We just need an email',
      body: "That's it. No password while you fill the form. If you come back later I'll send a magic link to resume. Your draft auto-saves on every field.",
      emailLabel: 'Email',
      nameLabel: 'First name (optional)',
      namePlaceholder: 'Marie',
      hint: 'Marc reads every form himself. No spam, no lists, no resale.',
      cta: 'Continue →',
      alreadyHaveAccount: 'Already have an account?',
      signIn: 'Sign in →',
    },
    typePicker: {
      eyebrow: 'what kind of problem',
      title: 'What kind of problem?',
      body: "Pick the closest one. If nothing matches, choose 'other' — Marc reads it personally and reroutes if needed.",
    },
    form: {
      eyebrow: 'the details',
      autosaved: '✓ Auto-saved on every field',
      back: '← Change type',
      continue: 'Submit →',
    },
    confirmation: {
      eyebrowAccepted: 'received',
      eyebrowWaitlist: 'received — waitlist',
      titleAccepted: "Thanks, it's received.",
      titleWaitlist: "Thanks, you're on the waitlist.",
      bodyAccepted:
        "I read every form myself — no AI between you and me. You'll get an honest reply (yes, no, or 'tell me more') in the next 72 hours, by email.",
      bodyWaitlist:
        "I'm currently full (1 active build + 1 in triage — my cap, to respect my family time). I'll reply as soon as a slot opens, usually a few weeks. Your draft stays saved.",
      sla: "Honest reply in 72h — yes, no, or 'tell me more.'",
      summaryTitle: 'What you sent me',
      summaryEmail: 'Email',
      summaryName: 'First name',
      summaryType: 'Problem type',
      summarySubmittedAt: 'Submitted on',
      summaryAnswers: 'Your answers',
      startOver: 'Start a new form',
      submitting: 'Sending…',
      submitError:
        'Connection hiccup while sending your intake. Your draft is saved — try again in a moment.',
      sessionLinkLabel: 'See your session →',
      sessionLinkHint: 'Your proposal is saved. You can follow it and reply here.',
      magicLinkSentTitle: 'Check your email to finish',
      magicLinkSentBody: (email: string) =>
        `A sign-in link was sent to ${email}. Open it to access your session — it expires in 30 minutes.`,
      magicLinkAgain: "Didn't get it? Resend the link",
    },
  },
}

export const DICT: Record<Lang, Copy> = { fr: FR, en: EN }
