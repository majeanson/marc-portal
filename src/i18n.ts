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
    adminConsole: 'Console',
    viewAsUser: 'Voir comme visiteur',
    exitPreview: 'Quitter aperçu',
    sections: {
      projects: 'Projets',
      how: 'Comment ça marche',
      journey: 'Parcours',
      pricing: 'Prix',
      vibe: 'Je fais / Je fais pas',
      about: 'À propos',
    },
  },

  brandTitle: 'Marc — dev québécois',
  metaDescription:
    "Marc, dev québécois. Le soir et la fin de semaine, j'aide les gens à régler des problèmes du quotidien avec du code. Async — pas de meetings, à ton rythme.",

  hero: {
    eyebrow: 'side-gig · Québec · async',
    folio: '№ 01 — Marc, dev québécois',
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
    fullJourneyCta: 'Voir le parcours complet (les 12 étapes) →',
    journeyCard: {
      eyebrow: 'envie de tout voir?',
      title: 'Le parcours complet, étape par étape',
      body: 'Les 4 grands moments ci-dessus se décomposent en 12 étapes concrètes. Le détail : qui fait quoi, en combien de temps, à quel moment.',
      stats: [
        { val: '6 / 12', label: 'étapes que tu fais' },
        { val: '≈ 20 min', label: 'ton temps total' },
        { val: '0', label: 'appels téléphoniques' },
      ],
      cta: 'Voir les 12 étapes →',
    },
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
        title: 'Je livre',
        body: 'Le projet devient une page publique (avec une option pour cacher tes données commerciales). Une ronde de retouches incluse.',
      },
    ],
  },

  featured: {
    eyebrow: 'projets en cours',
    title: 'Ce que je livre, en vrai',
    sub: 'Chaque carte est un projet vivant, vrai code, vrais problèmes, dernier build accessible.',
    seeAll: 'Voir tous les projets →',
    deeperLook: 'Coup d’œil approfondi sur la galerie →',
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
    body: 'Prix concrets, pas de devis caché. Chaque tier (niveau de prix) renvoie à des projets réels du même niveau — tu vois ce que ça donne avant de soumettre.',
    asOf: 'IV — Prix publics, en vigueur depuis 2026-05-15.',
    disclaimer:
      'Les prix peuvent bouger d’une saison à l’autre. Toujours négociables avant qu’on démarre, jamais de surprise après.',
    tier2Note:
      'Par défaut à la livraison : mode dépositaire (200 $/an) — Marc opère le site. Tu peux opter pour « Tout à toi » à la place si tu gères déjà ta stack.',
    tier2NoteCta: 'Comment ça finit →',
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
        scope:
          'Projet de quelques semaines. Outil interne qui dure. Projets de communauté. Payé en deux temps : 750 $ au démarrage, 750 $ à la livraison.',
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

  napkin: {
    eyebrow: 'sur un napperon',
    title: 'Dessine-moi le problème',
    sub: 'Pas de bon ou mauvais dessin. Trace, écris, gribouille. Tout ce qui aide à comprendre.',
    instruction:
      "Une boîte, deux flèches, un mot — n'importe quoi. Quand tu es prêt(e), un trait sur la description et envoie.",
    descLabel: 'En une phrase, c’est quoi?',
    descPlaceholder: 'Ex. « Mon café veut savoir qui prend quels quarts. »',
    submit: 'Envoyer au formulaire →',
    saving: 'Préparation…',
    blankErr: 'Trace au moins une chose ou écris une phrase avant d’envoyer.',
    loadingCanvas: 'Chargement du tableau blanc…',
    homeTeaser: 'Préfères dessiner? Essaie le napperon →',
    pillAttached: 'Napperon attaché',
    pillRemove: 'Retirer',
    pillView: 'Voir le dessin',
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
        a: 'Oui. Tier 0 est à 0 $ et sert à se voir si on est compatibles. Les tiers 1 à 3 ont un prix forfaitaire avant de commencer — on ne sort pas du forfait sans en reparler ensemble. Pas de facture surprise. Le reçu officiel vient de Stripe (noreply@stripe.com) — c’est normal, c’est mon processeur de paiement.',
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
        a: 'À toi, dans tous les cas. Deux modes : « Tout à toi » (tu détiens repo, domaine et comptes dès le jour 1) ou « Je m’en occupe » (je suis dépositaire des clés, transférables sur demande, sans frais, en environ une semaine). Aucun des deux ne te coince — <a href="/handoff">voir comment ça finit →</a>',
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
    body: 'Je suis dev depuis ~10 ans. Job de jour à temps plein (37,5 h/sem), une famille, et l’envie d’aider les petites entreprises et les gens autour de moi à se simplifier la vie sans payer une agence. Le portail, c’est ce qui rend ça possible — pour toi comme pour moi.',
    body2:
      'Pas une agence. Pas une plateforme. Un humain qui décide, une machine au milieu pour gérer le reste — pour qu’on respecte tous les deux nos soirs et nos fins de semaine.',
    portraitAlt: 'Marc',
    githubLabel: 'GitHub',
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
    draftPrompt: {
      title: 'Un brouillon est sauvegardé',
      body: 'Tu as commencé un intake sur cet appareil. Tu peux reprendre où tu étais ou repartir de zéro.',
      continueBtn: 'Reprendre le brouillon',
      freshBtn: 'Recommencer à zéro',
      summary: (savedAt: string) => `Dernière modification : ${savedAt}.`,
    },
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
      title: "J'ai besoin d'une adresse courriel",
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
      handoffMode: {
        label: 'Préférence de gestion (optionnel)',
        hint: "À la livraison, qui détient les clés? Par défaut Marc s'en occupe (200 $/an) — c'est ce qui te dispense de gérer DNS, Cloudflare, Resend toi-même. Modifiable plus tard ; « Tout à toi » demande une confirmation explicite à la livraison.",
        learnMore: 'Voir comment ça finit →',
        optionJe: "Je m'en occupe — Marc garde les clés (200 $/an, mode recommandé)",
        optionTout: 'Tout à toi — je gère DNS, Cloudflare, Resend moi-même',
        optionParle: 'On en parle plus tard',
      },
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
        `Je t’ai envoyé un lien de connexion à ${email}. Ouvre-le pour accéder à ta session — il expire dans 30 minutes.`,
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
    formBuildUrlPlaceholder: 'https://marcportal.com/demo/sunday-night-dread',
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
    shareCta: 'Partager',
    shareCtaHint: 'Voir l’aperçu qui s’affichera dans Slack, iMessage, etc.',
    shareModalTitle: 'Partage ce projet',
    shareModalSub:
      'Voici l’aperçu qui s’affichera quand tu colleras ce lien dans Slack, iMessage, etc.',
    sharePreviewAlt: 'Aperçu du carton de partage',
    shareClose: 'Fermer',
    shareNative: 'Partager…',
    scrubber: {
      title: 'Remonter le projet',
      eyebrow: 'machine à remonter',
      sub: 'Chaque étape rouvre le build de cette époque. Glisse, ou laisse jouer.',
      prev: 'Précédent',
      next: 'Suivant',
      play: 'Lecture',
      pause: 'Pause',
      stepLabel: (i: number, total: number) => `Étape ${i} sur ${total}`,
      ariaTrack: 'Frise des étapes',
      keyboardHint: 'Flèches ← / → pour naviguer, Espace pour lecture/pause.',
    },
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
    previewHeading: 'Aperçu du carton de partage',
    previewHint:
      'Voici ce qu’afficheront Slack, iMessage, etc. quand quelqu’un colle le lien de cette session. L’aperçu reflète la version *publiée* — enregistre pour le voir bouger.',
    previewDisabledHint:
      'Active la vitrine et enregistre — l’aperçu apparaîtra ici une fois la session publiée.',
    previewOpenInTab: 'Ouvrir le PNG',
  },

  adminShowcaseOverview: {
    eyebrow: 'vitrine — vue d’ensemble',
    title: 'Toutes les vitrines, d’un coup d’œil',
    sub: 'Vérifie la cohérence visuelle des cartes sociales avant qu’elles ne sortent. Titre trop long, sous-titre manquant, tier non assigné — tout est repéré ici.',
    loading: 'Chargement…',
    empty:
      'Aucune session en vitrine pour l’instant. Active la vitrine sur une session pour la voir apparaître ici.',
    error: 'Impossible de charger les vitrines.',
    editLink: 'Éditer →',
    openShare: 'Voir la page partage ↗',
    countSingular: '1 vitrine',
    countPlural: (n: number) => `${n} vitrines`,
    countWarnings: (n: number) => (n === 1 ? '1 alerte' : `${n} alertes`),
    warnings: {
      noTitle: 'Pas de titre',
      noTagline: 'Pas de sous-titre',
      noTier: 'Pas de tier',
      titleLong: 'Titre long (>60 car.)',
    },
  },

  journey: {
    pageTitle: 'Le parcours complet — de l’idée au paiement',
    metaDescription:
      'Le parcours complet, étape par étape : de ta première visite jusqu’au projet livré et payé. 12 étapes. Tu en fais la moitié. Ton temps total : ~20 minutes.',
    backHome: '← Retour à l’accueil',
    eyebrow: 'le parcours complet',
    title: 'De la première visite au projet livré et payé',
    sub: '12 étapes. Tu en fais 6, je fais les 6 autres. Ton temps total pour faire ta part : ~20 minutes. Le reste, c’est moi qui bosse — pendant que tu vis ta vie.',
    statYou: 'tes gestes',
    statYouVal: '6',
    statYouUnit: 'sur 12 étapes',
    statTime: 'ton temps total',
    statTimeVal: '≈ 20',
    statTimeUnit: 'minutes',
    statCalls: 'tes appels téléphoniques',
    statCallsVal: '0',
    statCallsUnit: 'jamais',
    actor: { you: 'ton geste', me: 'mon geste', both: 'ensemble' },
    legendTitle: 'Légende',
    legendYou: 'toi',
    legendMe: 'moi (Marc)',
    legendBoth: 'nous deux',
    phases: [
      {
        roman: 'I',
        name: 'Découverte',
        sub: 'tu lis, tu décides si ça matche',
        steps: [
          {
            num: '01',
            actor: 'you',
            duration: '30 s',
            where: 'page publique',
            title: 'Tu arrives sur le site',
            body: 'Pas de compte requis. Tu lis la vibe, les prix publics, les projets en cours. Si rien ne matche, tu repars — pas de frais, pas de drame.',
          },
          {
            num: '02',
            actor: 'you',
            duration: '5–10 min',
            where: 'portail',
            title: 'Tu décris ton problème',
            body: 'Formulaire guidé. Pas un call. Sauvegarde automatique — tu pars manger, tu reviens, ton brouillon est là. Tu peux même dessiner un croquis si les mots manquent.',
          },
          {
            num: '03',
            actor: 'you',
            duration: '1 clic',
            where: 'ton courriel',
            title: 'Le lien magique arrive dans ta boîte',
            body: 'Aucun mot de passe à inventer. Le lien crée ton compte gratuit en un clic et te ramène au bon endroit.',
          },
        ],
      },
      {
        roman: 'II',
        name: 'Triage',
        sub: 'je lis, je décide, je te reviens',
        steps: [
          {
            num: '04',
            actor: 'me',
            duration: '≤ 72 h',
            where: 'async',
            title: 'Je lis ce que tu as écrit',
            body: 'Pas d’IA entre toi et moi. Je lis chaque formulaire moi-même, en français ou en anglais — dans ta langue, je réponds dans ta langue.',
          },
          {
            num: '05',
            actor: 'me',
            duration: 'async',
            where: 'fil de session',
            title: 'Je réponds : oui, non, ou « raconte-moi plus »',
            body: 'Si oui : devis ferme écrit dans ton portail. Si non : je te redirige vers un patron Tier 0 gratuit, ou un dev qui matche mieux. Si entre les deux : je pose mes questions.',
          },
        ],
      },
      {
        roman: 'III',
        name: 'Build',
        sub: 'on bâtit ensemble, en direct',
        steps: [
          {
            num: '06',
            actor: 'you',
            duration: '1 min',
            where: 'Stripe',
            title: 'Tu paies le démarrage',
            body: 'Tier 1 : 300 $ en plein. Tier 2 : 750 $ de dépôt (le solde à la livraison). Tier 3 : selon devis. Reçu officiel automatique par Stripe.',
          },
          {
            num: '07',
            actor: 'me',
            duration: 'dès le jour 2',
            where: 'portail',
            title: 'Démo testable en continu',
            body: 'Je push chaque jour. Tu cliques quand tu veux voir où on en est — pas besoin d’attendre une réunion de mise à jour. Il n’y en a pas.',
          },
          {
            num: '08',
            actor: 'you',
            duration: 'à ton rythme',
            where: 'fil de session',
            title: 'Tu suis, tu commentes, tu corriges le tir',
            body: 'Tout vit dans le fil de session. Tu écris quand tu veux. Je vois, je réponds, j’ajuste. Pas de courriels perdus, pas de Slack à installer.',
          },
        ],
      },
      {
        roman: 'IV',
        name: 'Livraison',
        sub: 'je livre, tu payes, on choisit la suite',
        steps: [
          {
            num: '09',
            actor: 'me',
            duration: 'à la livraison',
            where: 'portail',
            title: 'Je livre — ton projet devient une page publique',
            body: 'Le build vit en ligne. Option : cacher tes données commerciales (noms de clients, chiffres) avant publication. Toi seul décides ce qui est public.',
          },
          {
            num: '10',
            actor: 'you',
            duration: '1 min',
            where: 'Stripe',
            title: 'Tu paies le solde',
            body: 'Tier 2 : les 750 $ qui restent. Tier 3 : le solde du devis. Reçu officiel Stripe — c’est ce qui sort sur ta compta.',
          },
          {
            num: '11',
            actor: 'both',
            duration: '7 jours',
            where: 'portail',
            title: 'Une ronde de retouches incluse (Tier 2+)',
            body: 'Tu testes en vrai pendant une semaine. Tu reviens avec une liste de petits ajustements. Je polis. Inclus dans le prix.',
          },
          {
            num: '12',
            actor: 'you',
            duration: 'à toi de choisir',
            where: 'page Mon compte',
            title: 'Handoff ou mode Dépositaire',
            body: 'Tu prends tout à ton nom (repo, domaine, comptes) OU tu me laisses garder les clés pour 200 $/an (petites retouches incluses, jusqu’à 2 h/mois). Annulable n’importe quand — bascule automatique vers « Tout à toi ».',
          },
        ],
      },
    ],
    outro: {
      title: 'C’est tout.',
      body: 'Si tu comptes, tu fais 6 gestes sur 12 — et la plupart prennent une minute. Les 6 autres, c’est moi qui bosse, pendant que tu fais autre chose. C’est ça, le contrat.',
      cta: 'Décris ton problème →',
    },
  },

  vouches: {
    pageTitle: 'Recommandations',
    heading: 'Quelques mots de gens qui ont travaillé avec moi',
    lead: "Le portail est rapide à essayer ; ces témoignages aident à savoir si le contact me va. Marc lit, peut resserrer le texte avant qu'il paraisse — et ton courriel n'apparaît jamais ici.",
    empty: 'Pas encore de témoignages publiés. Reviens dans quelques semaines.',
    relationshipLabels: {
      client: 'Client',
      colleague: 'Collègue',
      friend: 'Ami·e',
      other: 'Autre',
    },
    submitCta: 'Écrire un témoignage →',
    submit: {
      pageTitle: 'Écrire un témoignage',
      heading: "Tu as déjà travaillé avec moi ? Dis-le en quelques phrases.",
      lead: 'Court, honnête, à ta voix. Je relis avant que ça paraisse — coquilles, longueur, ton. Ton courriel reste en privé : c’est seulement pour pouvoir te recontacter si je dois ajuster un mot.',
      privacy:
        'Ton nom et tes mots seront visibles publiquement. Ton courriel ne sera jamais affiché.',
      successHeading: 'Reçu — merci.',
      successBody:
        'Je relis dans les prochains jours. Si c’est bon tel quel, ça paraît sans autre étape. Si je veux resserrer un mot, je t’écris.',
      submitAnother: 'Soumettre un autre témoignage',
      backHome: '← Retour à l’accueil',
      fields: {
        nameLabel: 'Ton nom',
        namePlaceholder: 'Alex Tremblay',
        emailLabel: 'Ton courriel (privé)',
        emailPlaceholder: 'alex@exemple.com',
        emailHint: 'Pour te recontacter si je dois ajuster. Jamais affiché.',
        relationshipLabel: 'Comment on se connaît',
        bodyLabel: 'Ton mot',
        bodyPlaceholder:
          "Ce qu'on a fait ensemble, ce que ça a changé, comment c'était de travailler avec moi…",
        bodyHint: '30 à 600 caractères.',
        linkLabel: 'Lien (optionnel)',
        linkPlaceholder: 'https://tonsite.ca',
        linkHint: 'Ton site, LinkedIn, GitHub — affiché à côté de ton nom.',
      },
      submitButton: 'Envoyer',
      submitting: 'Envoi…',
      errors: {
        rateLimit: 'Trop d’envois récents — réessaie dans une heure.',
        invalidName: 'Nom invalide — 2 à 80 caractères.',
        invalidEmail: 'Courriel invalide.',
        invalidRelationship: 'Choisis une option.',
        invalidBody: 'Le mot doit faire entre 30 et 600 caractères.',
        invalidLink: 'Le lien doit commencer par http(s):// et faire moins de 200 caractères.',
        generic: 'Quelque chose a planté. Réessaie ?',
      },
    },
  },

  notFound: {
    title: 'Cette page n’existe pas',
    body: 'Le lien que tu as suivi pointe sur quelque chose qui n’existe pas. Probablement une vieille URL.',
    homeCta: '← Retour à l’accueil',
    intakeCta: 'Démarrer une demande →',
  },

  errorBoundary: {
    title: 'Quelque chose a planté',
    body: 'Cette page n’a pas chargé. C’est probablement un changement déployé pendant que tu naviguais. Rafraîchis ; si ça persiste, écris-moi.',
    refreshCta: 'Rafraîchir',
    homeCta: '← Retour à l’accueil',
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
    adminConsole: 'Console',
    viewAsUser: 'View as user',
    exitPreview: 'Exit preview',
    sections: {
      projects: 'Projects',
      how: 'How it works',
      journey: 'Journey',
      pricing: 'Pricing',
      vibe: "What I do / don't",
      about: 'About',
    },
  },

  brandTitle: 'Marc — Québécois dev',
  metaDescription:
    'Marc, a Québécois dev. Evenings and weekends, I help people solve everyday problems with code. Async — no meetings, at your pace.',

  hero: {
    eyebrow: 'side-practice · Quebec · async',
    folio: '№ 01 — Marc, a Québécois dev',
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
    fullJourneyCta: 'See the full journey (all 12 steps) →',
    journeyCard: {
      eyebrow: 'want to see the whole thing?',
      title: 'The full journey, step by step',
      body: 'The 4 big moments above break down into 12 concrete steps. The detail: who does what, in how much time, at what point.',
      stats: [
        { val: '6 / 12', label: 'steps on your side' },
        { val: '≈ 20 min', label: 'your total time' },
        { val: '0', label: 'phone calls' },
      ],
      cta: 'See all 12 steps →',
    },
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
        title: 'I ship',
        body: 'The project becomes a public page (with an option to redact your commercial data). One round of post-ship tweaks included.',
      },
    ],
  },

  featured: {
    eyebrow: 'projects in progress',
    title: 'What I’m actually shipping',
    sub: 'Each card is a living project — real code, real problems, latest build open for inspection.',
    seeAll: 'See all projects →',
    deeperLook: 'Take a deeper look at the gallery →',
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
    title: 'What I do, what I don’t',
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
    body: 'Concrete prices, no hidden quotes. Each tier (price level) links to actual past projects of the same level — you see what it looks like before you submit.',
    asOf: 'IV — Public prices, effective 2026-05-15.',
    disclaimer:
      'Prices may move between seasons. Always negotiable before we start, never a surprise after.',
    tier2Note:
      'Default at delivery: custodian mode ($200/yr) — Marc operates the site. You can opt for "All yours" instead if you already manage your stack.',
    tier2NoteCta: 'How it ends →',
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
        scope:
          'A few-week project. An internal tool that lasts. Community projects. Paid in two halves: $750 to start, $750 at delivery.',
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

  napkin: {
    eyebrow: 'on a napkin',
    title: 'Sketch me the problem',
    sub: 'No good or bad drawings. Lines, words, arrows. Whatever helps me understand.',
    instruction:
      'A box, two arrows, a word — anything goes. When you’re done, a line on the description and send.',
    descLabel: 'In one sentence, what is it?',
    descPlaceholder: "e.g. 'My café wants to know who works which shifts.'",
    submit: 'Send to the form →',
    saving: 'Preparing…',
    blankErr: 'Draw at least one thing or write a sentence before sending.',
    loadingCanvas: 'Loading the whiteboard…',
    homeTeaser: 'Prefer to draw? Try the napkin →',
    pillAttached: 'Napkin attached',
    pillRemove: 'Remove',
    pillView: 'View sketch',
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
        a: "Yes. Tier 0 is $0 and exists so we can see if we're a fit. Tiers 1–3 are fixed-price quoted before we start — I won't go past the quote without a conversation first. No surprise invoice. The official receipt comes from Stripe (noreply@stripe.com) — that's normal, it's my payment processor.",
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
        a: "Yours either way. Two modes: 'All yours' (you hold the repo, domain, and accounts from day 1) or 'I handle it' (I'm custodian of the keys, transferable on demand, no fee, in about a week). Neither traps you — <a href=\"/en/handoff\">see how it ends →</a>",
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
    body: "I've been a dev for ~10 years. Full-time day job (37.5h/week), a family, and a desire to help small businesses and people around me simplify their lives without paying an agency. The portal is what makes that possible — for both of us.",
    body2:
      'Not an agency. Not a platform. A human who decides, with a bit of machine in the middle so we both keep our evenings and weekends.',
    portraitAlt: 'Marc',
    githubLabel: 'GitHub',
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
    draftPrompt: {
      title: 'A draft is saved',
      body: 'You started an intake on this device. Pick up where you left off, or start over.',
      continueBtn: 'Continue draft',
      freshBtn: 'Start fresh',
      summary: (savedAt: string) => `Last edited: ${savedAt}.`,
    },
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
      title: 'I just need an email',
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
      handoffMode: {
        label: 'Management preference (optional)',
        hint: "At delivery, who holds the keys? By default Marc handles it ($200/yr) — that's what saves you from managing DNS, Cloudflare, Resend yourself. Can change later; 'All yours' requires an explicit confirmation at delivery.",
        learnMore: 'See how it ends →',
        optionJe: 'I handle it — Marc keeps the keys ($200/yr, recommended)',
        optionTout: 'All yours — I manage DNS, Cloudflare, Resend myself',
        optionParle: "Let's talk later",
      },
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
        `I sent a sign-in link to ${email}. Open it to access your session — it expires in 30 minutes.`,
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
    formBuildUrlPlaceholder: 'https://marcportal.com/demo/sunday-night-dread',
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
    shareCta: 'Share',
    shareCtaHint: 'See the preview that will show up in Slack, iMessage, etc.',
    shareModalTitle: 'Share this project',
    shareModalSub:
      "Here's the preview people will see when this link is pasted into Slack, iMessage, etc.",
    sharePreviewAlt: 'Share card preview',
    shareClose: 'Close',
    shareNative: 'Share…',
    scrubber: {
      title: 'Rewind the project',
      eyebrow: 'time machine',
      sub: 'Each step reopens the build from that moment. Drag, or hit play.',
      prev: 'Previous',
      next: 'Next',
      play: 'Play',
      pause: 'Pause',
      stepLabel: (i: number, total: number) => `Step ${i} of ${total}`,
      ariaTrack: 'Step timeline',
      keyboardHint: 'Arrows ← / → to step, Space to play/pause.',
    },
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
    previewHeading: 'Share-card preview',
    previewHint:
      "Here's what Slack, iMessage, etc. will show when someone pastes this session's link. The preview reflects the *published* version — hit save to refresh it.",
    previewDisabledHint:
      'Turn on the showcase and save — the preview will appear here once the session is published.',
    previewOpenInTab: 'Open PNG',
  },

  adminShowcaseOverview: {
    eyebrow: 'showcase — overview',
    title: 'Every showcase, at a glance',
    sub: 'Brand-consistency check before cards go out into the world. Too-long titles, missing taglines, un-tiered sessions — all flagged here.',
    loading: 'Loading…',
    empty: "No showcased sessions yet. Turn on a session's showcase to see it appear here.",
    error: "Couldn't load the showcases.",
    editLink: 'Edit →',
    openShare: 'Open share page ↗',
    countSingular: '1 showcase',
    countPlural: (n: number) => `${n} showcases`,
    countWarnings: (n: number) => (n === 1 ? '1 warning' : `${n} warnings`),
    warnings: {
      noTitle: 'No title',
      noTagline: 'No tagline',
      noTier: 'No tier',
      titleLong: 'Title long (>60 chars)',
    },
  },

  journey: {
    pageTitle: 'The full journey — from idea to paid',
    metaDescription:
      'The full journey, step by step: from your first visit to a shipped, paid project. 12 steps. You do half of them. Your total time: ~20 minutes.',
    backHome: '← Back home',
    eyebrow: 'the full journey',
    title: 'From your first visit to a shipped, paid project',
    sub: '12 steps. You take 6, I take 6. Your total time across all your steps: ~20 minutes. The rest is me, working — while you live your life.',
    statYou: 'your moves',
    statYouVal: '6',
    statYouUnit: 'out of 12 steps',
    statTime: 'your total time',
    statTimeVal: '≈ 20',
    statTimeUnit: 'minutes',
    statCalls: 'phone calls',
    statCallsVal: '0',
    statCallsUnit: 'ever',
    actor: { you: 'your move', me: 'my move', both: 'together' },
    legendTitle: 'Legend',
    legendYou: 'you',
    legendMe: 'me (Marc)',
    legendBoth: 'both of us',
    phases: [
      {
        roman: 'I',
        name: 'Discover',
        sub: 'you read, you decide if it fits',
        steps: [
          {
            num: '01',
            actor: 'you',
            duration: '30 s',
            where: 'public page',
            title: 'You land on the site',
            body: 'No account needed. Read the vibe, the public prices, the projects in progress. If nothing matches, you walk away — no charge, no drama.',
          },
          {
            num: '02',
            actor: 'you',
            duration: '5–10 min',
            where: 'portal',
            title: 'You describe your problem',
            body: 'Guided form. Not a call. Auto-save — eat dinner, come back, your draft is right where you left it. You can even sketch a napkin if words fall short.',
          },
          {
            num: '03',
            actor: 'you',
            duration: '1 click',
            where: 'your inbox',
            title: 'A magic link lands in your inbox',
            body: 'No password to invent. The link creates your free account in one click and drops you back where you were.',
          },
        ],
      },
      {
        roman: 'II',
        name: 'Triage',
        sub: 'I read, I decide, I write back',
        steps: [
          {
            num: '04',
            actor: 'me',
            duration: '≤ 72h',
            where: 'async',
            title: 'I read what you wrote',
            body: 'No AI between you and me. I read every form myself, in French or English — you write in your language, I reply in your language.',
          },
          {
            num: '05',
            actor: 'me',
            duration: 'async',
            where: 'session thread',
            title: 'I reply: yes, no, or "tell me more"',
            body: 'Yes: a fixed-price quote in your portal. No: I redirect you to a free Tier 0 recipe, or to a dev who fits better. In between: I ask my questions.',
          },
        ],
      },
      {
        roman: 'III',
        name: 'Build',
        sub: 'we build together, in the open',
        steps: [
          {
            num: '06',
            actor: 'you',
            duration: '1 min',
            where: 'Stripe',
            title: 'You pay to start',
            body: 'Tier 1: $300 in full. Tier 2: $750 deposit (balance at delivery). Tier 3: per quote. Official receipt auto-issued by Stripe.',
          },
          {
            num: '07',
            actor: 'me',
            duration: 'from day 2',
            where: 'portal',
            title: 'Testable demo, continuously',
            body: 'I push every day. You click whenever you want to see where we are — no status meeting to wait for. There aren’t any.',
          },
          {
            num: '08',
            actor: 'you',
            duration: 'at your pace',
            where: 'session thread',
            title: 'You watch, comment, course-correct',
            body: 'Everything lives in the session thread. You write when you want. I see it, I reply, I adjust. No lost emails, no Slack to install.',
          },
        ],
      },
      {
        roman: 'IV',
        name: 'Ship',
        sub: 'I deliver, you pay, we choose what’s next',
        steps: [
          {
            num: '09',
            actor: 'me',
            duration: 'at delivery',
            where: 'portal',
            title: 'I ship — your project becomes a public page',
            body: 'The build goes live. Option: redact your commercial data (client names, numbers) before publishing. You alone decide what’s public.',
          },
          {
            num: '10',
            actor: 'you',
            duration: '1 min',
            where: 'Stripe',
            title: 'You pay the balance',
            body: 'Tier 2: the remaining $750. Tier 3: the quote balance. Official Stripe receipt — the one that shows up in your bookkeeping.',
          },
          {
            num: '11',
            actor: 'both',
            duration: '7 days',
            where: 'portal',
            title: 'One round of post-ship tweaks (Tier 2+)',
            body: 'You use it for real for a week. You come back with a small list. I polish. Included in the price.',
          },
          {
            num: '12',
            actor: 'you',
            duration: 'your call',
            where: 'My account page',
            title: 'Handoff or Custodian mode',
            body: 'Take everything in your name (repo, domain, accounts) OR let me hold the keys for $200/year (small tweaks included, up to 2h/month). Cancel anytime — auto-flip to "All yours".',
          },
        ],
      },
    ],
    outro: {
      title: 'That’s it.',
      body: 'If you’re counting, you take 6 moves out of 12 — and most are one minute. The other 6 are me, working, while you do something else. That’s the deal.',
      cta: 'Describe your problem →',
    },
  },

  vouches: {
    pageTitle: 'Vouches',
    heading: 'A few words from people who worked with me',
    lead: "The portal is quick to try; these vouches help you decide if the contact fits. Marc reads them, may tighten the wording before publishing — and your email never appears here.",
    empty: 'No vouches published yet. Check back in a few weeks.',
    relationshipLabels: {
      client: 'Client',
      colleague: 'Colleague',
      friend: 'Friend',
      other: 'Other',
    },
    submitCta: 'Write a vouch →',
    submit: {
      pageTitle: 'Write a vouch',
      heading: 'Worked with me before? Say it in a few sentences.',
      lead: "Short, honest, in your voice. I read before it ships — typos, length, tone. Your email stays private: it's only so I can reach back out if I need to tweak a word.",
      privacy: 'Your name and your words will be public. Your email will never be displayed.',
      successHeading: 'Got it — thanks.',
      successBody:
        'I read in the next few days. If it’s good as-is, it ships without another step. If I want to tighten a word, I’ll email you.',
      submitAnother: 'Submit another vouch',
      backHome: '← Back home',
      fields: {
        nameLabel: 'Your name',
        namePlaceholder: 'Alex Smith',
        emailLabel: 'Your email (private)',
        emailPlaceholder: 'alex@example.com',
        emailHint: 'So I can reach back if I need to adjust. Never shown.',
        relationshipLabel: 'How we know each other',
        bodyLabel: 'Your words',
        bodyPlaceholder: 'What we shipped, what it changed, what it was like working with me…',
        bodyHint: '30 to 600 characters.',
        linkLabel: 'Link (optional)',
        linkPlaceholder: 'https://yoursite.com',
        linkHint: 'Your site, LinkedIn, GitHub — shown next to your name.',
      },
      submitButton: 'Send',
      submitting: 'Sending…',
      errors: {
        rateLimit: 'Too many recent submissions — try again in an hour.',
        invalidName: 'Invalid name — 2 to 80 characters.',
        invalidEmail: 'Invalid email.',
        invalidRelationship: 'Pick an option.',
        invalidBody: 'Your words must be 30 to 600 characters.',
        invalidLink: 'Link must start with http(s):// and be under 200 characters.',
        generic: 'Something broke. Try again?',
      },
    },
  },

  notFound: {
    title: "This page doesn't exist",
    body: "The link you followed points at something that isn't here. Probably an old URL.",
    homeCta: '← Back home',
    intakeCta: 'Start a request →',
  },

  errorBoundary: {
    title: 'Something went sideways',
    body: "This page didn't load. Most likely a deploy raced your navigation. Refresh; if it sticks, write to me.",
    refreshCta: 'Refresh',
    homeCta: '← Back home',
  },
}

export const DICT: Record<Lang, Copy> = { fr: FR, en: EN }
