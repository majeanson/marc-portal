export type Lang = 'fr' | 'en'

export type Copy = typeof FR

const FR = {
  langCode: 'fr-CA',
  langSwitchLabel: 'EN',
  langSwitchHref: '/en',

  skipToContent: 'Aller au contenu principal',
  langNavLabel: 'Choix de langue',
  nav: {
    signIn: 'Connexion',
    signOut: 'Déconnexion',
    mySessions: 'Mes sessions',
    viewAsUser: 'Voir comme visiteur',
    exitPreview: 'Quitter aperçu',
    sections: {
      projects: 'Projets',
      how: 'Comment ça marche',
      pricing: 'Prix',
      vibe: 'Je fais / Je fais pas',
      about: 'À propos',
    },
  },

  brandTitle: 'Marc — dev à Québec',
  metaDescription:
    "Marc, dev à Québec. Le soir et la fin de semaine, j'aide les gens à régler des problèmes du quotidien avec du code. Async — pas de meetings, à ton rythme.",

  hero: {
    eyebrow: 'side-pratique · Québec · async',
    folio: '№ 01 — Marc, dev à Québec',
    salut: 'Marc-Antoine, là pour résoudre des problèmes importants pour ma communauté',
    display: {
      pre: 'Marc-Antoine,',
      lead: 'là pour résoudre',
      emphasis: 'des problèmes importants',
      tail: 'pour ma communauté.',
    },
    signature: 'Marc — Québec',
    body1:
      'Comme side-gig, j’aide les gens à régler des problèmes du quotidien. En asynchrone/différé (pas de calls, pas de meetings). Le tout à travers mon portail, à ton rythme et au mien.',
    body2:
      "Tu as un problème qui revient toujours, paperasse, suivi, coordination? Ton problème n'est pas un enjeu national, mais tout de même irritant ? Décris-le moi via le portail.",
    body3:
      "Compte gratuit. Tu testes, vois la démo à chaque étape. Premier brouillon en quelques jours. On se rend jusqu'au bout ensemble. Tout transparent.",
    cta: 'Crée ton compte gratuit →',
    ctaWaitlist: 'Rejoindre la liste d’attente →',
    ctaLoggedIn: 'Démarrer une nouvelle proposition →',
    mySessionsLink: 'Voir mes sessions',
    bilingual: '(Aussi en anglais — je réponds dans ta langue.)',
  },

  how: {
    eyebrow: 'Quatre étapes',
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

  featured: {
    eyebrow: 'projets en cours',
    title: 'Ce que je livre, en vrai',
    sub: 'Chaque carte est un projet vivant, vrai code, vrais problèmes, dernier build accessible.',
    seeAll: 'Voir tous les projets →',
    loading: 'Chargement…',
    openBuild: 'Ouvrir le build ↗',
    untitled: 'Projet sans titre',
    currentBuildLabel: 'Build actuel',
    noBuildYet: 'Pas encore de build épinglé',
    tierPrefix: 'Tier',
    emptyTitle: 'Le premier projet atterrit ici très bientôt.',
    emptyBody:
      'Pas encore de projet publié — la galerie est neuve. Tu peux quand même découvrir comment ça marche, ou m’écrire via le portail pour ouvrir le premier dossier.',
    emptyCta: 'Décris ton problème →',
    errorTitle: 'Impossible de charger les projets pour le moment.',
    errorBody: 'Tu peux toujours ouvrir la galerie complète, ou écrire via le portail.',
  },

  vibe: {
    eyebrow: 'attrape mon vibe',
    title: 'Ce que je fais, ce que je ne fais pas',
    body: 'Lis cette liste avant de remplir le formulaire. Si ça matche, on va bien s’entendre. Sinon, pas de drame, y a plein d’autres devs qui font autre chose.',
    do: {
      title: 'Je fais',
      items: [
        'Tout simplement votre idée',
        'Automatisation de tout genre',
        'Coordination de petites équipes ou de bénévoles',
        'Portfolios, sites découvertes',
      ],
    },
    dont: {
      title: 'Je ne fais pas',
      items: [
        'Calls, meetings, vidéos planifiées',
        'Bug fixes urgents ou support 24/7',
        'Changements de scope en cours de projet',
        'Du travail dans le beurre',
      ],
    },
  },

  pricing: {
    eyebrow: 'prix publics',
    title: 'Combien ça coûte',
    body: 'Prix concrets, pas « contactez-nous ». Chaque tier (niveau de prix) renvoie à des projets réels du même niveau — tu vois ce que ça donne avant de soumettre.',
    tiers: [
      {
        name: 'Tier 0',
        price: 'Gratuit',
        scope:
          'Ton problème est trop petit pour engager un dev. Je te redirige vers un patron (modèle prêt-à-utiliser) ou un template no-code.',
        after: 'auto-service',
      },
      {
        name: 'Tier 1',
        price: '≈ 300 $',
        scope:
          'Petit projet simple. Petit script, portfolio, automatisation, formulaire qui marche.',
        after: '0 retouches après livraison',
      },
      {
        name: 'Tier 2',
        price: '≈ 1 500 $',
        scope: 'Projet de quelques semaines. Outil interne qui dure. Projets de communauté',
        after: '1 ronde de retouches incluse',
        anchor: true,
      },
      {
        name: 'Tier 3',
        price: '≈ 3 000 $+',
        scope: 'Projet plus gros. Sur devis après triage (l’étape où je lis et je décide).',
        after: 'devis post-triage',
      },
    ],
  },

  cta: {
    eyebrow: 'prêt?',
    title: 'Décris ton problème',
    body: "Compte gratuit. Aucun call. Je lis chaque formulaire moi-même et je te réponds en 72 h. Oui, non, « j'ai plus de questions » ou « raconte-moi plus ».",
    button: 'Ouvrir le formulaire →',
    buttonLoggedIn: 'Démarrer une nouvelle proposition →',
    micro:
      'Si je suis plein, tu peux quand même créer un compte et te mettre sur la liste d’attente.',
  },

  stickyCta: {
    label: 'Démarrer une session',
    short: 'Démarrer →',
    ariaLabel: 'Démarrer une session — ouvrir le formulaire',
  },

  themeToggle: {
    switchToDay: 'Mode jour',
    switchToNight: 'Mode nuit',
  },

  projectsFilter: {
    tierLabel: 'Tier',
    statusLabel: 'État',
    all: 'Tout',
    clear: 'Réinitialiser',
    emptyAfterFilter: 'Aucun projet ne correspond. Essaie un autre filtre.',
    statusLabels: {
      draft: 'brouillon',
      triage: 'triage',
      active: 'en cours',
      shipped: 'livré',
      rejected: 'refusé',
    },
  },

  inlineTeaser: {
    eyebrow: 'commence ici',
    title: "Choisis ton type de problème — je m'occupe du reste",
    sub: 'Un clic et tu sautes l’étape « type de problème » dans le formulaire. Tu peux changer d’idée plus tard.',
    types: {
      paperasse: 'Paperasse à automatiser',
      suivi: 'Suivi (clients, inventaire, projets)',
      coordination: 'Coordination (équipe, bénévoles, voisinage)',
      autre: 'Autre — décris-moi ça librement',
    },
    cta: 'Continuer →',
  },

  faq: {
    eyebrow: 'questions fréquentes',
    title: 'Ça revient souvent',
    expandAll: 'Tout ouvrir',
    collapseAll: 'Tout fermer',
    // Stable slugs shared across FR + EN so /share/?#faq-price works in
    // either language. Order must match `items` below.
    slugs: ['price', 'timeline', 'result', 'unclear', 'ownership', 'bring-own'] as const,
    items: [
      {
        q: 'Le prix annoncé, c’est vraiment ça?',
        a: 'Oui. Tier 0 est à 0 $ et sert à se voir si on est compatibles. Les tiers 1 à 3 ont un prix forfaitaire avant de commencer — on ne sort pas du forfait sans en reparler ensemble. Pas de facture surprise.',
      },
      {
        q: 'Et si ça prend plus de temps que prévu?',
        a: 'Si je dépasse, c’est mon problème — le prix reste celui du devis. Si la portée change en cours de route (tu ajoutes des choses), on s’arrête, on regarde, et on décide ensemble : ajuster le devis ou couper.',
      },
      {
        q: 'Et si je n’aime pas le résultat?',
        a: 'Tu vois une démo testable à chaque étape — pas juste à la fin. Si à mi-chemin tu réalises que ça ne convient pas, on arrête. Je facture le travail fait à ce jour, pas un cent de plus. Aucun engagement à finir.',
      },
      {
        q: 'Je ne sais pas exactement ce que je veux. C’est ok?',
        a: 'C’est même attendu. Décris le problème comme il te vient, en français/anglais, dans tes mots. Mon job c’est de poser les bonnes questions et de te montrer une version concrète sur laquelle tu peux réagir.',
      },
      {
        q: 'À qui appartient le code à la fin?',
        a: 'À toi. Le repo Git, les comptes, le domaine — tout. Si un jour tu veux migrer à quelqu’un d’autre ou tout reprendre toi-même, il n’y a rien à dénouer.',
      },
      {
        q: 'Je peux apporter mes propres designs ou maquettes?',
        a: 'Avec plaisir. Figma, Sketch, dessin sur napperon — tout est bienvenu. Sinon, je propose une direction visuelle simple et on l’ajuste ensemble.',
      },
    ],
  },

  about: {
    eyebrow: 'qui je suis',
    title: 'À propos',
    body: 'Je suis dev senior depuis ~10 ans. Job de jour à temps plein (37,5 h/sem), une famille, et l’envie d’aider les petites entreprises et les gens autour de moi à se simplifier la vie sans payer une agence. Le portail, c’est ce qui rend ça possible — pour toi comme pour moi.',
    body2:
      'Pas une agence. Pas une plateforme. Un humain qui décide, une machine au milieu pour gérer le reste — pour qu’on respecte tous les deux nos soirs et nos fins de semaine.',
    portraitAlt: 'Marc',
    githubLabel: 'GitHub',
    linkedinLabel: 'LinkedIn',
  },

  footer: {
    contact: 'Contact : via le portail uniquement (pas d’email, pas de téléphone).',
    legal: 'Hébergé au Canada · Loi 25 · OQLF',
    copyright: '© Marc 2026',
  },

  pullQuote: {
    body: 'Pas une agence. Pas une plateforme. Un humain qui décide, une machine au milieu pour gérer le reste.',
    attribution: 'Marc',
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
      "Pas de honte. Si ton budget est sous 200 $ et que ton problème entre dans une de ces 4 catégories, voici la recette. Tu n'as rien à acheter et tu n'as pas besoin de moi.",
    principle:
      "Principe : la bonne solution pour un problème de 50 $ est gratuite. Si ton problème grandit (5+ employés, plusieurs équipes, données critiques), reviens me voir — c'est là que je vaux mon prix.",
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
      "Pendant la semaine, tu dictes des notes vocales dans ton truck. Ici, tu peux 'jouer' 3 notes composites pour voir comment elles deviennent un brouillon de facture le dimanche matin.",
    clipsTitle: '1. Notes vocales de la semaine',
    clipsHint: "Clique pour 'jouer' chaque note. Tu peux en jouer une, deux ou les trois.",
    transcriptLabel: 'Transcription',
    atClient: 'chez {name}',
    parsedTitle: '2. Ce que le système extrait',
    parsedHint:
      'Texte libre + lexique de chantier québécois. Pas de listes déroulantes. Le parser (l’algorithme qui lit) trouve le client, les heures, les matériaux.',
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
    disclaimer:
      'Démo statique avec voix-clients composites. Le code et le parser sont vrais. Aucune donnée réelle, aucun email envoyé.',
  },

  intake: {
    pageTitle: 'Décris ton problème — formulaire',
    metaDescription:
      "Formulaire d'intake (demande de projet) pour Marc. Async, à ton rythme. Sauvegarde automatique. Réponse en 72 h.",
    backHome: "← Retour à l'accueil",
    capacity: {
      atCap:
        "Je suis plein en ce moment. Tu peux quand même soumettre — je te mets sur la liste d'attente et je te réponds quand un slot ouvre.",
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
      body: "C'est tout. Pas de mot de passe pendant que tu remplis. Si tu reviens plus tard, je t'envoie un lien magique (un lien par courriel) pour reprendre. Le brouillon se sauvegarde tout seul à chaque champ.",
      emailLabel: 'Courriel',
      nameLabel: 'Ton prénom (optionnel)',
      namePlaceholder: 'Marie',
      hint: 'Marc lit chaque formulaire lui-même. Aucun spam, aucune liste, aucune revente.',
      cta: 'Continuer →',
      alreadyHaveAccount: 'Tu as déjà un compte ?',
      signIn: 'Connecte-toi →',
      signedInAsEyebrow: 'compte connecté',
      signedInAsTitle: 'Connecté en tant que',
      signedInAsBody:
        'Cette demande sera rattachée à ton compte. Tu pourras la rouvrir et la modifier dans tes sessions.',
      signedInAsCta: 'Continuer avec ce compte →',
      signedInAsSwitch: 'Utiliser une autre adresse',
    },
    typePicker: {
      eyebrow: 'quel genre de problème',
      title: 'Quel genre de problème?',
      body: 'Choisis celui qui se rapproche le plus. Si rien ne colle, prends « autre » — Marc va le lire et le rediriger au besoin.',
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
        "Je lis chaque formulaire moi-même. Pas d'IA entre toi et moi. Tu auras une réponse honnête en 72 h, par courriel — oui, non, ou « raconte-moi plus ».",
      bodyWaitlist:
        "Je suis plein en ce moment : 1 projet actif + 1 en triage, c'est mon plafond pour respecter ma famille. Je te réponds dès qu'un slot ouvre, en général quelques semaines. Le brouillon reste sauvegardé.",
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
      sessionEditHint:
        'Tu peux modifier tes réponses à tout moment depuis ton portail (« Mes sessions »).',
      magicLinkSentTitle: 'Vérifie ton courriel pour finaliser',
      magicLinkSentBody: (email: string) =>
        `On t’a envoyé un lien de connexion à ${email}. Ouvre-le pour accéder à ta session — il expire dans 30 minutes.`,
      magicLinkAgain: 'Pas reçu ? Renvoyer le lien',
      parkedStripHint: 'Ton formulaire est en attente — il démarre dès ta connexion.',
    },
  },

  sessionAdvancements: {
    heading: 'Avancées du build',
    subtitle:
      'Étapes du build avec un lien vers le déploiement Cloudflare correspondant — chaque entrée est un build que tu peux ouvrir.',
    loading: 'Chargement…',
    empty: 'Aucune avancée publiée pour l’instant.',
    currentLabel: 'Build actuel',
    formEyebrow: 'Publier une avancée',
    formLabel: 'Titre',
    formLabelPlaceholder: 'Rev 1 — première démo testable',
    formBody: 'Description',
    formBodyPlaceholder: 'Ce qui a changé dans ce build, ce qu’il y a à tester.',
    formIframePath: 'Chemin de l’iframe (optionnel)',
    formIframePathPlaceholder: '/me, /demo/sunday-night-dread, etc.',
    formIframePathHint:
      'Site-relatif (commence par /). Vide = racine du déploiement. Sert à pointer l’iframe sur la page la plus pertinente.',
    formBuildUrl: 'URL du build (optionnel)',
    formBuildUrlPlaceholder: 'https://snd-demo.pages.dev',
    formBuildUrlHint:
      'Pour un build hébergé ailleurs (autre repo, autre projet Cloudflare). Vide = stamping automatique au prochain déploiement du portail.',
    formFlags: 'Visibilité',
    flagAllowedForPublic: 'Visible publiquement',
    flagShowInConversation: 'Afficher dans la conversation',
    flagShowAsCurrentBuild: 'Épingler comme « build actuel »',
    formSubmit: 'Publier',
    formSubmitting: 'Publication…',
    formStampHint:
      'Le lien Cloudflare et le commit sont ajoutés automatiquement au prochain déploiement.',
    formError: 'Échec — réessaie.',
    save: 'Enregistrer',
    saving: 'Enregistrement…',
    doneEditing: 'Terminer',
    editEntry: 'Modifier',
    deleteEntry: 'Supprimer',
    confirmDelete: (label: string) => `Supprimer l’avancée « ${label} » ? Action irréversible.`,
    pillPublic: 'public',
    pillInThread: 'thread',
    pillPendingStamp: 'en attente du build',
    viewBuild: 'Voir ce build →',
    hideBuild: 'Cacher l’aperçu',
    openInNewTab: 'Ouvrir dans un onglet ↗',
    buildHint:
      'Aperçu réel du déploiement à cette étape (Cloudflare Pages). Si l’aperçu reste vide, ouvre-le dans un onglet.',
    commitLabel: 'commit',
    iframeTitle: 'Aperçu du build',
    timelineLabel: 'Avancée publiée',
    shareHeading: 'Lien public partageable',
    shareCopy: 'Copier le lien',
    shareCopied: 'Copié ✓',
  },

  projects: {
    eyebrow: 'projets',
    heading: 'Projets en cours',
    intro:
      'Sessions que je publie au public — chacune un projet vivant, avec son dernier build accessible.',
    loading: 'Chargement…',
    empty: 'Rien de publié pour le moment. Reviens bientôt.',
    error: 'Impossible de charger les projets.',
    untitled: 'Projet sans titre',
    currentBuildLabel: 'Build actuel',
    noBuildYet: 'Pas encore de build épinglé',
    openCta: 'Voir les avancées →',
    openBuild: 'Ouvrir le build ↗',
    tierPrefix: 'Tier',
    placeholderEyebrow: 'votre projet ici',
    placeholderHeading: 'Une place vous attend',
    placeholderIntro: 'Peu importe le tier — un point de départ.',
    placeholderT0Cta: 'Voir Tier 0 →',
    placeholderIntakeCta: "Démarrer l'intake →",
  },

  showcaseAdmin: {
    sectionHeading: 'Projets en vitrine',
    sectionHint:
      'Quand tu actives la vitrine, cette session apparaît sur /projects avec le titre et le sous-titre que tu donnes ici.',
    enabledLabel: 'Publier comme projet sur /projects',
    titleLabel: 'Titre du projet (optionnel)',
    titlePlaceholder: 'Truck Notes — voix → facture',
    taglineLabel: 'Sous-titre court (optionnel)',
    taglinePlaceholder: 'Notes vocales du truck → brouillon de facture le dimanche.',
    tierLabel: 'Tier',
    tierHint: 'Calibre la session par rapport à la grille de prix publique.',
    tierOptionNone: 'Non classé',
    tierOption0: 'Tier 0 · auto-service',
    tierOption1: 'Tier 1 · ≈ 300 $',
    tierOption2: 'Tier 2 · ≈ 1 500 $',
    tierOption3: 'Tier 3 · ≈ 3 000 $+',
    save: 'Enregistrer',
    saving: 'Enregistrement…',
    saveError: 'Échec — réessaie.',
    saved: 'Enregistré ✓',
    galleryLink: 'Voir la galerie →',
  },
}

const EN: Copy = {
  langCode: 'en-CA',
  langSwitchLabel: 'FR',
  langSwitchHref: '/',

  skipToContent: 'Skip to main content',
  langNavLabel: 'Language selection',
  nav: {
    signIn: 'Sign in',
    signOut: 'Sign out',
    mySessions: 'My sessions',
    viewAsUser: 'View as user',
    exitPreview: 'Exit preview',
    sections: {
      projects: 'Projects',
      how: 'How it works',
      pricing: 'Pricing',
      vibe: "What I do / don't",
      about: 'About',
    },
  },

  brandTitle: 'Marc — dev in Quebec City',
  metaDescription:
    'Marc, a dev in Quebec City. Evenings and weekends, I help people solve everyday problems with code. Async — no meetings, at your pace.',

  hero: {
    eyebrow: 'side-practice · Quebec · async',
    folio: '№ 01 — Marc, a dev in Quebec',
    salut: 'Marc-Antoine, here to solve important problems for my community',
    display: {
      pre: 'Marc-Antoine,',
      lead: 'here to solve',
      emphasis: 'important problems',
      tail: 'for my community.',
    },
    signature: 'Marc — Quebec',
    body1:
      'As a side-gig, I help people solve everyday problems. Asynchronous (no calls, no meetings). All through my portal, at your pace and mine.',
    body2:
      "Got a recurring problem — paperwork, tracking, coordination? It's not a national crisis, but it's still annoying? Tell me about it through the portal.",
    body3:
      'Free account. You test, see the demo at every step. First draft in a few days. We see it through to the end together. All transparent.',
    cta: 'Create a free account →',
    ctaWaitlist: 'Join the waitlist →',
    ctaLoggedIn: 'Start a new proposal →',
    mySessionsLink: 'View my sessions',
    bilingual: '(Also in French — I reply in your language.)',
  },

  how: {
    eyebrow: 'Four steps',
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

  featured: {
    eyebrow: 'projects in progress',
    title: 'What I’m actually shipping',
    sub: 'Each card is a living project — real code, real problems, latest build open for inspection.',
    seeAll: 'See all projects →',
    loading: 'Loading…',
    openBuild: 'Open the build ↗',
    untitled: 'Untitled project',
    currentBuildLabel: 'Current build',
    noBuildYet: 'No pinned build yet',
    tierPrefix: 'Tier',
    emptyTitle: 'The first project lands here very soon.',
    emptyBody:
      'No published projects yet — the gallery is new. You can still see how it works, or open the first one through the portal.',
    emptyCta: 'Describe your problem →',
    errorTitle: 'Can’t load the projects right now.',
    errorBody: 'You can still open the full gallery, or write through the portal.',
  },

  vibe: {
    eyebrow: 'catch the vibe',
    title: 'What we do, what we don’t',
    body: "Read this before filling out the form. If it matches, we'll get along. If not, no drama — there are plenty of other devs who do other things.",
    do: {
      title: 'I do',
      items: [
        'Quite simply, your idea',
        'Automation of any kind',
        'Coordination for small teams or volunteers',
        'Portfolios, discovery sites',
      ],
    },
    dont: {
      title: "I don't",
      items: [
        'Calls, meetings, scheduled video',
        'Urgent bug fixes or 24/7 support',
        'Mid-project scope changes',
        'Work that goes nowhere',
      ],
    },
  },

  pricing: {
    eyebrow: 'public pricing',
    title: 'What it costs',
    body: 'Concrete prices, no "contact us." Each tier (price level) links to actual past projects of the same level — you see what it looks like before you submit.',
    tiers: [
      {
        name: 'Tier 0',
        price: 'Free',
        scope:
          'Your problem is too small to hire a dev. I redirect you to a similar pattern (a ready-made recipe) or a no-code template.',
        after: 'self-service',
      },
      {
        name: 'Tier 1',
        price: '≈ $300',
        scope: 'Small simple project. Small script, portfolio, automation, a form that works.',
        after: '0 post-ship tweaks',
      },
      {
        name: 'Tier 2',
        price: '≈ $1500',
        scope: 'A few-week project. An internal tool that lasts. Community projects.',
        after: '1 round of tweaks included',
        anchor: true,
      },
      {
        name: 'Tier 3',
        price: '≈ $3000+',
        scope: 'Bigger project. Custom-quoted after triage (the step where I read it and decide).',
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

  stickyCta: {
    label: 'Start a session',
    short: 'Start →',
    ariaLabel: 'Start a session — open the form',
  },

  themeToggle: {
    switchToDay: 'Day mode',
    switchToNight: 'Night mode',
  },

  projectsFilter: {
    tierLabel: 'Tier',
    statusLabel: 'Status',
    all: 'All',
    clear: 'Reset',
    emptyAfterFilter: 'No projects match. Try another filter.',
    statusLabels: {
      draft: 'draft',
      triage: 'triage',
      active: 'active',
      shipped: 'shipped',
      rejected: 'rejected',
    },
  },

  inlineTeaser: {
    eyebrow: 'start here',
    title: "Pick the kind of problem — I'll take it from there",
    sub: "One click and you'll skip the 'project type' step in the form. You can change your mind later.",
    types: {
      paperasse: 'Paperwork to automate',
      suivi: 'Tracking (clients, inventory, projects)',
      coordination: 'Coordination (team, volunteers, neighbours)',
      autre: 'Other — describe it in your own words',
    },
    cta: 'Continue →',
  },

  faq: {
    eyebrow: 'frequently asked',
    title: 'Questions that come up',
    expandAll: 'Expand all',
    collapseAll: 'Collapse all',
    // Stable slugs shared with FR so /#faq-price works in either language.
    // Order must match `items` below.
    slugs: ['price', 'timeline', 'result', 'unclear', 'ownership', 'bring-own'] as const,
    items: [
      {
        q: 'Is the price really that price?',
        a: "Yes. Tier 0 is $0 and exists so we can see if we're a fit. Tiers 1–3 are fixed-price quoted before we start — I won't go past the quote without a conversation first. No surprise invoice.",
      },
      {
        q: 'What if it takes longer than expected?',
        a: "If I run over, that's on me — the price stays what was quoted. If the scope changes mid-flight (you're adding new things), we pause, look at it, and decide together: adjust the quote or cut.",
      },
      {
        q: "What if I don't like the result?",
        a: "You see a testable demo at every step — not just at the end. If halfway through you realize it's not what you wanted, we stop. I bill for the work done to date, not a penny more. No obligation to finish.",
      },
      {
        q: "I don't know exactly what I want. Is that ok?",
        a: "It's expected. Describe the problem the way it comes to you, in French or English, in your own words. My job is to ask the right questions and put a concrete version in front of you to react to.",
      },
      {
        q: 'Who owns the code at the end?',
        a: "You do. The Git repo, the accounts, the domain — all yours. If you ever want to migrate to someone else or take it over yourself, there's nothing to untangle.",
      },
      {
        q: 'Can I bring my own designs or mockups?',
        a: 'Please do. Figma, Sketch, napkin sketch — all welcome. Otherwise, I propose a simple visual direction and we adjust together.',
      },
    ],
  },

  about: {
    eyebrow: 'who I am',
    title: 'About',
    body: "I've been a senior dev for ~10 years. Full-time day job (37.5h/week), a family, and a desire to help small businesses and people around me simplify their lives without paying an agency. The portal is what makes that possible — for both of us.",
    body2:
      'Not an agency. Not a platform. A human who decides, with a bit of machine in the middle so we both keep our evenings and weekends.',
    portraitAlt: 'Marc',
    githubLabel: 'GitHub',
    linkedinLabel: 'LinkedIn',
  },

  footer: {
    contact: 'Contact: through the portal only (no email, no phone).',
    legal: 'Hosted in Canada · Bill 25 · OQLF',
    copyright: '© Marc 2026',
  },

  pullQuote: {
    body: 'Not an agency. Not a platform. A human deciding, with a machine in the middle for the rest.',
    attribution: 'Marc',
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
      "No shame. If your budget is under $200 and your problem fits one of these 4 categories, here's the recipe. You don't need to buy anything and you don't need me.",
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
      'Free text + Quebec construction lexicon. No dropdowns. The parser (the algorithm that reads it) finds the client, hours, and materials.',
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
    disclaimer:
      'Static demo with composite client voices. The code and parser are real. No real data, no email sent.',
  },

  intake: {
    pageTitle: 'Describe your problem — form',
    metaDescription:
      "Intake (project request) form for Marc's side-practice. Async, at your pace. Auto-save. Reply within 72h.",
    backHome: '← Back home',
    capacity: {
      atCap:
        "I'm full right now. You can still submit — I'll put you on the waitlist and reply when a slot opens.",
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
      body: "That's it. No password while you fill the form. If you come back later, I'll send a magic link (a sign-in link by email) to resume. Your draft auto-saves on every field.",
      emailLabel: 'Email',
      nameLabel: 'First name (optional)',
      namePlaceholder: 'Marie',
      hint: 'Marc reads every form himself. No spam, no lists, no resale.',
      cta: 'Continue →',
      alreadyHaveAccount: 'Already have an account?',
      signIn: 'Sign in →',
      signedInAsEyebrow: 'signed-in account',
      signedInAsTitle: 'Signed in as',
      signedInAsBody:
        "This proposal will be tied to your account. You'll be able to reopen and edit it in your sessions.",
      signedInAsCta: 'Continue with this account →',
      signedInAsSwitch: 'Use a different email',
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
        "I read every form myself. No AI between you and me. You'll get an honest reply in 72h, by email — yes, no, or 'tell me more.'",
      bodyWaitlist:
        "I'm full right now: 1 active build + 1 in triage — my cap, to respect my family time. I'll reply as soon as a slot opens, usually a few weeks. Your draft stays saved.",
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
      sessionEditHint: 'You can edit your answers anytime from your portal ("My sessions").',
      magicLinkSentTitle: 'Check your email to finish',
      magicLinkSentBody: (email: string) =>
        `A sign-in link was sent to ${email}. Open it to access your session — it expires in 30 minutes.`,
      magicLinkAgain: "Didn't get it? Resend the link",
      parkedStripHint: 'Your form is parked — it kicks off as soon as you sign in.',
    },
  },

  sessionAdvancements: {
    heading: 'Build advancements',
    subtitle:
      'Build milestones with a link to the matching Cloudflare deployment — each entry is a build you can open.',
    loading: 'Loading…',
    empty: 'No advancements posted yet.',
    currentLabel: 'Current build',
    formEyebrow: 'Post an advancement',
    formLabel: 'Title',
    formLabelPlaceholder: 'Rev 1 — first testable demo',
    formBody: 'Description',
    formBodyPlaceholder: "What changed in this build, what's worth poking at.",
    formIframePath: 'Iframe path (optional)',
    formIframePathPlaceholder: '/me, /demo/sunday-night-dread, etc.',
    formIframePathHint:
      'Site-relative (starts with /). Empty = deploy root. Used to focus the iframe on the most relevant page.',
    formBuildUrl: 'Build URL (optional)',
    formBuildUrlPlaceholder: 'https://snd-demo.pages.dev',
    formBuildUrlHint:
      'For a build hosted elsewhere (different repo or Cloudflare project). Empty = auto-stamp on the portal’s next deploy.',
    formFlags: 'Visibility',
    flagAllowedForPublic: 'Visible publicly',
    flagShowInConversation: 'Show in the conversation',
    flagShowAsCurrentBuild: 'Pin as "current build"',
    formSubmit: 'Post',
    formSubmitting: 'Posting…',
    formStampHint: 'The Cloudflare URL and commit are added automatically on the next deploy.',
    formError: 'Failed — try again.',
    save: 'Save',
    saving: 'Saving…',
    doneEditing: 'Done',
    editEntry: 'Edit',
    deleteEntry: 'Delete',
    confirmDelete: (label: string) => `Delete advancement "${label}"? This can't be undone.`,
    pillPublic: 'public',
    pillInThread: 'thread',
    pillPendingStamp: 'awaiting build',
    viewBuild: 'View this build →',
    hideBuild: 'Hide preview',
    openInNewTab: 'Open in new tab ↗',
    buildHint:
      'Live preview of the deployment at this step (Cloudflare Pages). If the preview stays blank, open it in a new tab.',
    commitLabel: 'commit',
    iframeTitle: 'Build preview',
    timelineLabel: 'Advancement posted',
    shareHeading: 'Public share link',
    shareCopy: 'Copy link',
    shareCopied: 'Copied ✓',
  },

  projects: {
    eyebrow: 'projects',
    heading: 'Projects in flight',
    intro:
      'Sessions I’m publishing to the public — each a living project with its latest build open for inspection.',
    loading: 'Loading…',
    empty: 'Nothing published yet. Check back soon.',
    error: 'Failed to load projects.',
    untitled: 'Untitled project',
    currentBuildLabel: 'Current build',
    noBuildYet: 'No pinned build yet',
    openCta: 'See the advancements →',
    openBuild: 'Open the build ↗',
    tierPrefix: 'Tier',
    placeholderEyebrow: 'your project here',
    placeholderHeading: 'A slot is waiting',
    placeholderIntro: 'At any tier — a starting line.',
    placeholderT0Cta: 'Browse Tier 0 →',
    placeholderIntakeCta: 'Start the intake →',
  },

  showcaseAdmin: {
    sectionHeading: 'Showcased projects',
    sectionHint:
      'When you turn this on, this session appears on /projects with the title and tagline you set here.',
    enabledLabel: 'Publish as a project on /projects',
    titleLabel: 'Project title (optional)',
    titlePlaceholder: 'Truck Notes — voice → invoice',
    taglineLabel: 'Short tagline (optional)',
    taglinePlaceholder: 'Truck voice notes → draft invoice by Sunday morning.',
    tierLabel: 'Tier',
    tierHint: 'Position the session against the public pricing tiers.',
    tierOptionNone: 'Unclassified',
    tierOption0: 'Tier 0 · self-service',
    tierOption1: 'Tier 1 · ≈ $300',
    tierOption2: 'Tier 2 · ≈ $1500',
    tierOption3: 'Tier 3 · ≈ $3000+',
    save: 'Save',
    saving: 'Saving…',
    saveError: 'Failed — try again.',
    saved: 'Saved ✓',
    galleryLink: 'See the gallery →',
  },
}

export const DICT: Record<Lang, Copy> = { fr: FR, en: EN }
