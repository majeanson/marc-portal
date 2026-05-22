export type Lang = 'fr' | 'en'

export type Copy = typeof FR

/**
 * Three bilingual-copy patterns exist in this codebase. Use this guide
 * when picking one (decided 2026-05 standardization pass):
 *
 *   1. `DICT[lang].something` (this file)
 *      For shared chrome (header nav, footer, status labels) and the long
 *      marketing copy on public-facing pages (Home, Tier0, Projects,
 *      Journey, Vouches, etc.). One file means typeof FR is the
 *      compile-time parity contract: every key in FR must exist in EN.
 *      Use when: copy is reused across components OR is core
 *      marketing/visitor-facing content.
 *
 *   2. Inline `const COPY = { fr: {...}, en: {...} } as const` at the
 *      top of a single component file.
 *      For page-specific copy that nothing else references. Cheaper than
 *      adding 200 keys to this file for one operator-only surface.
 *      Use when: the copy is local to one component AND would just bulk
 *      up i18n.ts without anyone else reusing it. Examples: Privacy,
 *      Pia, Handoff, Map, AdminHub, AdminRunbook.
 *
 *   3. `Bi { fr: string; en: string }` shape, used by data files.
 *      For lists of structured items where each item has bilingual
 *      labels — Runbook steps (trackA.ts, trackB.ts), map nodes/groups
 *      (curated.ts, types.ts). The shape pairs with the data, not the
 *      component, so the component renders generically over either lang.
 *      Use when: building a list/array/graph of bilingual items
 *      consumed by a single renderer.
 *
 * Anti-patterns to avoid:
 *   - Don't mix patterns inside one file. Pick one.
 *   - Don't inline copy in JSX (`{lang === 'fr' ? 'Suivant →' : 'Next →'}`) —
 *     extract to one of the three patterns above so the parity contract
 *     stays visible.
 *   - Don't add tiny one-off operator-only copy to DICT — that's
 *     pattern #2's job.
 */
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
      pricing: 'Prix',
      vibe: 'Je fais / Je fais pas',
      about: 'À propos',
    },
  },

  brandTitle: '№ 01 · Marc, dev québécois',
  // Title swapped in when the tab loses focus (visibilitychange → hidden).
  // Restored on refocus. Echoes the napperon "fait main" voice — a tiny
  // wave at visitors who have tab-parked us. Home-only.
  tabAway: '👋 reviens-moi · Marc',
  metaDescription:
    "Marc, dev québécois. Le soir et la fin de semaine, j'aide les gens à régler des problèmes du quotidien avec du code. Tout est async, sans meetings, à ton rythme.",

  hero: {
    eyebrow: 'side-gig · Québec · async',
    folio: '№ 01 · Marc, dev québécois',
    salut: 'Marc-Antoine, là pour résoudre des problèmes importants pour ma communauté',
    display: {
      pre: 'Marc-Antoine,',
      lead: 'là pour résoudre',
      emphasis: 'des problèmes importants',
      tail: 'pour ma communauté.',
    },
    signature: 'Marc, dev québécois',
    body2:
      "Tu as une affaire plate qui revient chaque semaine. De la paperasse à retaper, un suivi qui se perd, du monde à coordonner. C'est pas un enjeu national, mais c'est assez tannant pour mériter mieux. Raconte-moi ça.",
    cta: 'Crée ton compte gratuit →',
    ctaWaitlist: 'Rejoindre la liste d’attente →',
    ctaLoggedIn: 'Démarrer une nouvelle proposition →',
    mySessionsLink: 'Voir mes sessions',
    // Split so the language word ("anglais") renders as a link that
    // switches the page to that language. See Hero.tsx.
    bilingual: { pre: '(Aussi en ', link: 'anglais', post: ', je réponds dans ta langue.)' },
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
        body: "Tu remplis un formulaire guidé. Aucun appel à planifier. Ça se sauvegarde tout seul à mesure, fait que tu peux fermer l'onglet et revenir quand ça te tente.",
      },
      {
        num: '02',
        title: 'Je te réponds en 72 h',
        body: 'Oui, non, ou « raconte-moi plus ». Je lis chaque formulaire moi-même. Pas d’IA entre toi et moi.',
      },
      {
        num: '03',
        title: 'Tu suis le travail en direct',
        body: 'Démo testable dès le 2e jour. Aucune réunion de statut à attendre, parce que tout vit dans le portail.',
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
    sub: 'Derrière chaque carte, un projet qui roule pour vrai. Du code en production, des problèmes concrets, et un build que tu peux aller tester maintenant.',
    seeAll: 'Voir tous les projets →',
    galleryCard: {
      eyebrow: 'envie de tout voir?',
      title: 'La galerie complète, tous les projets',
      body: 'Au-delà des trois cartes ci-dessus, la galerie filtre par tier et par statut. Chaque carte ouvre le détail du projet avec le dernier build en direct.',
      cta: 'Voir tous les projets →',
    },
    loading: 'Chargement…',
    openBuild: 'Ouvrir le build ↗',
    untitled: 'Projet sans titre',
    currentBuildLabel: 'Build actuel',
    noBuildYet: 'Pas encore de build épinglé',
    tierPrefix: 'Niveau',
    emptyTitle: 'Le premier projet atterrit ici très bientôt.',
    emptyBody:
      'Pas encore de projet publié, la galerie est neuve. Tu peux quand même découvrir comment ça marche, ou m’écrire via le portail pour ouvrir le premier dossier.',
    emptyCta: 'Décris ton problème →',
    errorTitle: 'Impossible de charger les projets pour le moment.',
    errorBody: 'Tu peux toujours ouvrir la galerie complète, ou écrire via le portail.',
  },

  featuredTestimonials: {
    eyebrow: 'preuves sociales',
    title: 'Quelques mots de gens qui ont travaillé avec moi',
    sub: 'Témoignages courts, soumis par les vrais collaborateurs. Je relis, je peux resserrer la formulation, mais le contenu reste leur voix.',
    writeOne: 'Tu as travaillé avec moi ? Écris un témoignage →',
    galleryCard: {
      eyebrow: 'tu veux tout lire ?',
      title: 'Tous les témoignages, sur une seule page',
      body: 'La liste complète vit sur /vouches : chronologique, sans filtre, avec le nom et le lien de chaque personne.',
      cta: 'Voir tous les témoignages →',
    },
  },

  vibe: {
    eyebrow: 'attrape mon vibe',
    title: 'Ce que je fais, ce que je ne fais pas',
    body: 'Lis cette liste avant de remplir le formulaire. Si ça matche, on va bien s’entendre. Sinon, pas de drame, y a plein d’autres devs qui font autre chose.',
    do: {
      title: 'Je fais',
      items: [
        'Tout simplement ton idée',
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

  bringAnything: {
    eyebrow: 'aucune idée trop petite',
    title: 'Apporte-moi n’importe quoi',
    body: 'Je veux que toutes les idées arrivent dans ma boîte : petites, weird, à moitié formées, peu importe. Mon job, c’est de filtrer. Le tien, c’est juste de décrire ce qui te trotte dans la tête.',
    examplesTitle: 'Des idées que je prendrais sans hésiter',
    examples: [
      'Tes notes vocales du truck → un brouillon de facture qui t’attend le dimanche matin',
      'Un site une-page pour les 30 ans de ton chum avec un mot de chaque ami',
      'Un outil pour aider ta grand-mère à organiser ses recettes',
      'Un compteur « jours sans… » (cigarette, jeu vidéo, peu importe)',
      'Une page mémorial avec photos pour ton chat décédé',
      'Un catalogue des blagues internes de ton groupe d’amis',
      'Une calculatrice qui résout exactement UN problème dans ta job',
      'Un tableau de bord pour la cuisine (météo, todo, anniversaires)',
      'Une carte des bons cafés sur le bord de la 132',
    ],
    reassure:
      'Si c’est trop petit pour mes prix, je te montre comment le faire toi-même (Niveau 0, gratuit). Trop gros ou entre les deux, on en parle et je triage. Dans tous les cas, je veux le voir avant de décider.',
    cta: 'Décris ton idée →',
  },

  pricing: {
    eyebrow: 'prix publics',
    title: 'Combien ça coûte',
    body: 'Prix concrets, pas de devis caché. Chaque niveau renvoie à des projets réels du même calibre. Tu vois ce que ça donne avant de soumettre.',
    asOf: 'Prix publics, en vigueur depuis 2026-06-01.',
    disclaimer:
      'Les prix sont fixes avant qu’on commence. Pas de surprise après : si je dépasse, c’est mon problème. Taxes en sus si applicable.',
    custodianNote:
      'Mode dépositaire : après la livraison, je garde le site en ligne et à jour. Deux forfaits annuels : Watch (120 $/an) ou Care (400 $/an, avec 2 h/an de retouches). Les changements plus gros se facturent à 75 $/h. Tu peux choisir « Tout à toi » à la place si tu préfères gérer toi-même.',
    custodianNoteHeading: 'Et après la livraison ?',
    custodianNoteCta: 'Comment ça finit →',
    rescueNoteHeading: 'Tu as déjà quelque chose ?',
    rescueNote:
      'Une app générée par une IA qui plante, un site laissé en plan, un vieux code que personne ne veut toucher. Je commence par regarder ce qu’il a (rapport de cadrage, 250 $, crédité sur la réparation), puis je le répare ou je le refais à neuf. Le prix de la réparation, je te le donne après, une fois que je sais à quoi j’ai affaire.',
    rescueNoteCta: 'Décrire ce que tu as →',
    tiers: [
      {
        name: 'Niveau 0',
        price: 'Gratuit',
        scope:
          'Ton problème est trop petit pour engager un dev. Je te redirige vers un patron (modèle prêt-à-utiliser) ou un template no-code.',
        example:
          'Ex. la rotation de pelletage du voisinage, ou le RSVP d’un party : un patron, et tu pars avec.',
        after: 'auto-service',
      },
      {
        name: 'Niveau 1',
        price: '750 $',
        scope:
          'Un truc qui marche, hébergé et mis en ligne. Pas une démo que tu dois garder en vie toi-même. Un livrable précis : un formulaire, un script, une automatisation, une page. Sans compte, sans multi-utilisateur.',
        example: 'Ex. un formulaire web qui rentre direct dans ton chiffrier, sans rien retaper.',
        after: 'payé en plein',
      },
      {
        name: 'Niveau 2',
        price: '1 800 $',
        scope:
          'Un petit outil. Quelques écrans, des données, peut-être une connexion. Payé en deux temps : 900 $ au démarrage, 900 $ à la livraison.',
        example:
          'Ex. tes notes vocales du truck transformées en brouillon de facture le dimanche matin.',
        after: '50 / 50',
      },
      {
        name: 'Niveau 3',
        price: '3 600 $',
        scope:
          'Un outil qui dure. Vrai modèle de données, une connexion, plusieurs utilisateurs. Payé en versements (50/50 ou 40/40/20).',
        example: 'Ex. un outil de gestion sur mesure pour ta petite équipe.',
        after: 'en versements',
        anchor: true,
      },
      {
        name: 'Niveau 4',
        price: 'à partir de 7 500 $',
        scope:
          'Une plateforme. Plus gros, multi-rôles. Sur devis après triage (l’étape où je lis et je décide).',
        example: 'Ex. une plateforme pour une coopérative, ou un outil pour toute une équipe.',
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
    ariaLabel: 'Démarrer une session, ouvrir le formulaire',
    // Swapped in once the visitor scrolls past most of the page — same
    // destination, different mood.
    farLabel: 'T’es rendu loin →',
    dismissLabel: 'Cacher',
    pebbleAriaLabel: 'Reprendre, démarrer une session',
  },

  themeToggle: {
    switchToDay: 'Mode jour',
    switchToNight: 'Mode nuit',
  },

  napkin: {
    eyebrow: 'sur un napperon',
    title: 'Dessine-moi le problème',
    instruction: "Une boîte, deux flèches, un mot, n'importe quoi qui aide à comprendre.",
    descLabel: 'En une phrase, c’est quoi?',
    descPlaceholder: 'Ex. « Mon café veut savoir qui prend quels quarts. »',
    loadingCanvas: 'Chargement du tableau blanc…',
    homeTeaser: 'Tu préfères dessiner ? Le napperon est dans le formulaire →',
    formTeaser: 'Les mots ne suffisent pas ? Dessine-le →',
    formReopen: 'Croquis joint, voir ou modifier →',
    formHide: 'Masquer le croquis',
    formRemove: 'Retirer le croquis',
    pillView: 'Voir le dessin',
    sceneOpen: 'Ouvrir le croquis interactif →',
    sceneHide: 'Masquer le croquis interactif',
    replayPlay: 'Rejouer le tracé ▶',
    replayDrawing: 'Tracé en cours…',
  },

  media: {
    voice: {
      record: 'Enregistrer une note vocale',
      recording: 'Enregistrement',
      stop: 'Arrêter',
      rerecord: 'Refaire',
      cancel: 'Annuler',
      retry: 'Réessayer',
      working: 'Un instant…',
      error:
        "Le micro n'a pas répondu. Vérifie la permission du navigateur, ou écris-le simplement.",
    },
    compose: {
      voiceTrigger: '🎙 Note vocale',
      sketchTrigger: '✎ Croquis',
      voiceConsent:
        'Utilise ton micro. Le clip est joint à ce message et transcrit pour rester cherchable.',
      voiceAttach: 'Joindre la note vocale',
      sketchAttach: 'Joindre le croquis',
      sketchCancel: 'Annuler le croquis',
      sketchHint:
        "Un gribouillage en dit souvent plus long qu'un paragraphe. Il se joint direct à ton message.",
      voiceChip: 'Note vocale',
      sketchChip: 'Croquis',
      processing: 'Ajout…',
    },
    thread: {
      voiceLabel: 'Note vocale',
      transcriptLabel: 'Transcription',
      transcriptPending: 'Transcription indisponible.',
      sketchLabel: 'Croquis',
      sketchOpen: 'Ouvrir le croquis',
      sketchClose: 'Masquer le croquis',
    },
    intake: {
      voiceTeaser: 'Tu préfères le dire à voix haute ? Enregistre une note vocale →',
      voiceReopen: 'Note vocale enregistrée, revoir →',
      voiceHide: 'Masquer la note vocale',
      voiceRemove: 'Retirer la note vocale',
      voiceConsent:
        'Utilise ton micro. Le clip est transcrit sur Cloudflare puis aussitôt supprimé. Seul le texte ci-dessous est gardé avec ta demande.',
      voiceUse: 'Transcrire',
      title: 'Dis-moi le problème à voix haute',
      transcriptLabel: 'Ce que j’ai entendu (corrige au besoin)',
      transcriptPlaceholder: 'Tes mots transcrits apparaissent ici…',
    },
  },

  projectsFilter: {
    tierLabel: 'Niveau',
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
    title: "Choisis ton type de problème, je m'occupe du reste",
    sub: 'Un clic et tu sautes l’étape « type de problème » dans le formulaire. Tu peux changer d’idée plus tard.',
    types: {
      paperasse: 'Paperasse à automatiser',
      suivi: 'Suivi (clients, inventaire, projets)',
      coordination: 'Coordination (équipe, bénévoles, voisinage)',
      autre: 'Autre, décris-moi ça librement',
      rescue: 'Réparer un truc qui existe déjà',
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
    slugs: ['price', 'diy-ai', 'timeline', 'result', 'unclear', 'ownership', 'bring-own'] as const,
    items: [
      {
        q: 'Le prix annoncé, c’est vraiment ça?',
        a: 'Oui. Le Niveau 0 est à 0 $ et sert à se voir si on est compatibles. Les niveaux 1 à 3 ont un prix forfaitaire avant de commencer, et on ne sort pas du forfait sans en reparler ensemble. Pas de facture surprise. Le reçu officiel vient de Stripe : c’est normal, c’est mon processeur de paiement.',
      },
      {
        q: 'Je pourrais pas juste le faire moi-même avec un générateur d’app IA?',
        a: 'Pour un problème de Niveau 0, probablement que oui, et je te pointe vers un outil ou un template gratuitement. C’est exactement à ça que sert le Niveau 0. Pour le reste, construire n’a jamais été la partie difficile. Un générateur IA a besoin que tu saches exactement quoi lui demander, et la plupart des gens ne le savent pas encore. Trouver ça, c’est le triage. Il te sort une démo rapide, puis te laisse pris avec le login qui marche à moitié, les données qui se perdent, l’hébergement, le nom de domaine. C’est toi qui debugges à 21 h sans personne à appeler. Ce que tu paies, c’est un prix fixe, un outil qui tient le coup pour de vrai, et un nom responsable quand quelque chose brise des mois plus tard. Déjà pris avec une app IA à moitié faite ? Ça, c’est un <a href="/intake">sauvetage</a> : je regarde ce qui cloche et je te dis franchement si ça se répare. Si ton idée est assez petite pour que rien de ça ne te dérange, prends le générateur, je te le dirai franchement.',
      },
      {
        q: 'Et si ça prend plus de temps que prévu?',
        a: 'Si je dépasse, c’est mon problème : le prix reste celui du devis. Si la portée change en cours de route (tu ajoutes des choses), on s’arrête, on regarde, et on décide ensemble : ajuster le devis ou couper.',
      },
      {
        q: 'Et si je n’aime pas le résultat?',
        a: 'Tu vois une démo testable à chaque étape, pas juste à la fin. Si à mi-chemin tu réalises que ça ne convient pas, on arrête. Je facture le travail fait à ce jour, pas un cent de plus. Aucun engagement à finir.',
      },
      {
        q: 'Je ne sais pas exactement ce que je veux. C’est ok?',
        a: 'C’est même attendu. Décris comme il te vient, dans tes mots, sans te filtrer. Si ça sonne trop petit, trop weird, ou pas assez « professionnel », écris-le pareil. C’est moi qui décide ce qui rentre. Mon job c’est de poser les bonnes questions et de te montrer une version concrète sur laquelle tu peux réagir.',
      },
      {
        q: 'À qui appartient le code à la fin?',
        a: 'À toi, dans tous les cas. Deux modes : « Tout à toi » (tu détiens repo, domaine et comptes dès le jour 1) ou « Je m’en occupe » (je suis dépositaire des clés, transférables sur demande, sans frais, en environ une semaine). Aucun des deux ne te coince. <a href="/handoff">Voir comment ça finit →</a>',
      },
      {
        q: 'Je peux apporter mes propres designs ou maquettes?',
        a: 'Avec plaisir. Figma, Sketch, dessin sur napperon, tout est bienvenu. Sinon, je propose une direction visuelle simple et on l’ajuste ensemble.',
      },
    ],
  },

  about: {
    eyebrow: 'qui je suis',
    title: 'À propos',
    body: 'Je suis dev depuis ~10 ans. Job de jour à temps plein (37,5 h/sem), une famille, et l’envie d’aider les petites entreprises et les gens autour de moi à se simplifier la vie sans payer une agence. Le portail, c’est ce qui rend ça possible, pour toi comme pour moi.',
    body2:
      'C’est un gars qui décide, avec juste ce qu’il faut de machine pour gérer la logistique. Pas une agence, pas une plateforme géante. C’est ça qui nous garde nos soirées, à tous les deux.',
    portraitAlt: 'Marc',
    githubLabel: 'GitHub',
  },

  footer: {
    contact: {
      pre: 'Contact : ',
      link: 'démarre une session',
      post: ' et on en parle là. Au-delà de ça, je ne suis pas joignable.',
    },
    legal: 'Hébergé au Canada · Loi 25 · OQLF',
    copyright: '© Marc 2026',
  },

  pullQuote: {
    body: 'Je serai toujours honnête sur ton projet, même quand la réponse, c’est « garde ton argent ».',
    attribution: 'Marc',
  },

  engagement: {
    statusBarLabel: "Étape de l'engagement",
    demoNotice: 'EXEMPLE · engagement en cours',
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
        "Pas encore déployé. L'aperçu apparaîtra ici dès le jour 5 (engagement type Niveau 2).",
    },
    thread: {
      title: "Le fil de l'engagement",
      body: 'Toute la communication tient ici, en ordre chronologique. Personne n’a à fouiller ses courriels ou à céduler un meeting pour savoir où on est rendus.',
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
      body: "Cette URL ne correspond à aucun engagement public. Si tu es un client, vérifie ton lien. Sinon, retour à l'accueil.",
    },
  },

  tier0: {
    pageTitle: 'Niveau 0 · outils gratuits pour problèmes plus petits',
    metaDescription:
      "Patrons gratuits pour les problèmes du quotidien trop petits pour engager un dev : rotation de pelletage, RSVP, suivi d'heures, prêts entre voisins.",
    backHome: "← Retour à l'accueil",
    eyebrow: 'Niveau 0 · auto-service · gratuit',
    title: 'Ton problème est trop petit pour engager un dev. Voici comment le régler toi-même',
    intro:
      "Pas de honte. Si ton budget est sous 750 $ et que ton problème entre dans une de ces 4 catégories, voici la recette. Tu n'as rien à acheter et tu n'as pas besoin de moi.",
    problemLabel: 'Le problème',
    recipeLabel: 'La recette',
    growBack:
      "Si un de ces patrons ne suffit plus, c'est que ton problème a grandi. Bonne nouvelle, c'est probablement Niveau 1 ou 2 maintenant. Décris-moi ça.",
    intakeCta: 'Mon problème a grandi → ouvrir le formulaire',
  },

  intake: {
    pageTitle: 'Décris ton problème · formulaire',
    metaDescription:
      "Formulaire d'intake (demande de projet) pour Marc. Async, à ton rythme. Sauvegarde automatique. Réponse en 72 h.",
    backHome: "← Retour à l'accueil",
    mast: {
      eyebrow: 'Demande de session',
      title: 'Tu décris un problème',
      lead: 'Ce n’est pas un formulaire de contact. Le remplir ouvre une vraie session de travail : un fil privé où on amène ton problème de l’idée brute à une réponse claire. Rien n’est envoyé tant que tu ne soumets pas, et chaque champ se sauvegarde tout seul.',
    },
    draftPrompt: {
      title: 'Un brouillon est sauvegardé',
      body: 'Tu as commencé un intake sur cet appareil. Tu peux reprendre où tu étais ou repartir de zéro.',
      continueBtn: 'Reprendre le brouillon',
      freshBtn: 'Recommencer à zéro',
      summary: (savedAt: string) => `Dernière modification : ${savedAt}.`,
    },
    capacity: {
      atCap:
        "Je suis plein en ce moment. Tu peux quand même soumettre : je te mets sur la liste d'attente et je te réponds quand un slot ouvre.",
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
      // Quirky swap-in shown after the visitor ticks the box — same
      // checkbox, warmer text. Non-blocking: the CTA always works.
      ackThanks: "✓ Merci d'avoir lu, t'as compris la vibe.",
      cta: 'Continuer →',
    },
    account: {
      eyebrow: 'compte gratuit',
      title: "J'ai besoin d'une adresse courriel",
      body: "C'est tout. Pas de mot de passe pendant que tu remplis. Si tu reviens plus tard, je t'envoie un lien de connexion par courriel pour reprendre. Pas de compte à créer, pas de mot de passe à inventer. Le brouillon se sauvegarde tout seul à chaque champ.",
      emailLabel: 'Courriel',
      nameLabel: 'Ton prénom (optionnel)',
      namePlaceholder: 'Marie',
      hint: 'Marc lit chaque formulaire lui-même. Aucun spam, aucune revente.',
      autosaveNote: '✓ Pas de pression, ton brouillon t’attend si tu reviens.',
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
      body: 'Choisis celui qui se rapproche le plus. Si rien ne colle, prends « autre » : Marc va le lire et le rediriger au besoin.',
    },
    form: {
      eyebrow: 'le détail',
      autosaved: '✓ Sauvegardé automatiquement à chaque champ',
      back: '← Changer de type',
      continue: 'Soumettre →',
      handoffMode: {
        label: 'Préférence de gestion (optionnel)',
        hint: "À la livraison, qui détient les clés? Par défaut Marc s'en occupe (forfait annuel), ce qui t'évite de gérer DNS, Cloudflare, Resend toi-même. Modifiable plus tard ; « Tout à toi » demande une confirmation explicite à la livraison.",
        learnMore: 'Voir comment ça finit →',
        optionJe: "Je m'en occupe : Marc garde les clés (forfait annuel, mode recommandé)",
        optionTout: 'Tout à toi : je gère DNS, Cloudflare, Resend moi-même',
        optionParle: 'On en parle plus tard',
      },
    },
    confirmation: {
      eyebrowAccepted: 'reçu',
      eyebrowWaitlist: "reçu · liste d'attente",
      titleAccepted: "Merci, c'est reçu.",
      titleWaitlist: "Merci, tu es sur la liste d'attente.",
      bodyAccepted:
        "Je lis chaque formulaire moi-même. Pas d'IA entre toi et moi. Tu auras une réponse honnête en 72 h, par courriel : oui, non, ou « raconte-moi plus ».",
      bodyWaitlist:
        "Je suis plein en ce moment : 1 projet actif + 1 en triage, c'est mon plafond pour respecter ma famille. Je te réponds dès qu'un slot ouvre, en général quelques semaines. Le brouillon reste sauvegardé.",
      sla: 'Réponse honnête en 72 h : oui, non, ou « raconte-moi plus ».',
      summaryTitle: "Ce que tu m'as envoyé",
      summaryEmail: 'Courriel',
      summaryName: 'Prénom',
      summaryType: 'Type de problème',
      summarySubmittedAt: 'Soumis le',
      summaryAnswers: 'Tes réponses',
      startOver: 'Recommencer un nouveau formulaire',
      submitting: 'Envoi en cours…',
      submitError:
        'Hmm, problème de connexion en envoyant ton intake. Ton brouillon est sauvegardé, réessaie dans un instant.',
      sessionLinkLabel: 'Voir ta session →',
      sessionLinkHint: 'Ta proposition est enregistrée. Tu peux la suivre et y répondre ici.',
      sessionEditHint:
        'Tu peux modifier tes réponses à tout moment depuis ton portail (« Mes sessions »).',
      magicLinkSentTitle: 'Vérifie ton courriel pour finaliser',
      magicLinkSentBody: (email: string) =>
        `Je t’ai envoyé un lien de connexion à ${email}. Ouvre-le pour accéder à ta session. Il expire dans 30 minutes.`,
      magicLinkAgain: 'Pas reçu ? Renvoyer le lien',
      parkedStripHint: 'Ton formulaire est en attente, il démarre dès ta connexion.',
    },
  },

  sessionAdvancements: {
    heading: 'Avancées du build',
    subtitle:
      'Étapes du build avec un lien vers le déploiement Cloudflare correspondant. Chaque entrée est un build que tu peux ouvrir.',
    loading: 'Chargement…',
    empty: 'Aucune avancée publiée pour l’instant.',
    currentLabel: 'Build actuel',
    formEyebrow: 'Publier une avancée',
    formLabel: 'Titre',
    formLabelPlaceholder: 'Rev 1 · première démo testable',
    formBody: 'Description',
    formBodyPlaceholder: 'Ce qui a changé dans ce build, ce qu’il y a à tester.',
    formIframePath: 'Chemin de l’iframe (optionnel)',
    formIframePathPlaceholder: '/me, /projects, etc.',
    formIframePathHint:
      'Site-relatif (commence par /). Vide = racine du déploiement. Sert à pointer l’iframe sur la page la plus pertinente.',
    formBuildUrl: 'URL du build (optionnel)',
    formBuildUrlPlaceholder: 'https://marcportal.com/projects',
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
    formError: 'Échec, réessaie.',
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
    testimonials: {
      eyebrow: 'témoignages',
      heading: 'Mots de gens qui ont touché ce projet',
      empty: 'Pas encore de témoignages pour ce projet.',
      ctaTitle: 'Tu as touché à ce projet ?',
      ctaBody:
        'Si Marc t’a aidé sur ce projet précis, dis-le en quelques phrases, ça paraîtra ici.',
      ctaButton: 'Écrire un témoignage →',
    },
  },

  projects: {
    eyebrow: 'projets',
    heading: 'Projets en cours',
    intro:
      'Sessions que je publie au public, chacune un projet vivant, avec son dernier build accessible.',
    loading: 'Chargement…',
    empty: 'Rien de publié pour le moment. Reviens bientôt.',
    error: 'Impossible de charger les projets.',
    untitled: 'Projet sans titre',
    currentBuildLabel: 'Build actuel',
    noBuildYet: 'Pas encore de build épinglé',
    openCta: 'Voir les avancées →',
    openBuild: 'Ouvrir le build ↗',
    tierPrefix: 'Niveau',
    placeholderEyebrow: 'ton projet ici',
    placeholderHeading: 'Une place t’attend',
    placeholderIntro: 'Peu importe le niveau, un point de départ.',
    placeholderT0Cta: 'Voir Niveau 0 →',
    placeholderIntakeCta: "Démarrer l'intake →",
  },

  showcaseAdmin: {
    sectionHeading: 'Projets en vitrine',
    sectionHint:
      'Quand tu actives la vitrine, cette session apparaît sur /projects avec le titre et le sous-titre que tu donnes ici.',
    enabledLabel: 'Publier comme projet sur /projects',
    titleLabel: 'Titre du projet (optionnel)',
    titlePlaceholder: 'Truck Notes · voix → facture',
    taglineLabel: 'Sous-titre court (optionnel)',
    taglinePlaceholder: 'Notes vocales du truck → brouillon de facture le dimanche.',
    tierLabel: 'Niveau',
    tierHint: 'Calibre la session par rapport à la grille de prix publique.',
    tierOptionNone: 'Non classé',
    tierOption0: 'Niveau 0 · auto-service',
    tierOption1: 'Niveau 1 · 750 $',
    tierOption2: 'Niveau 2 · 1 800 $',
    tierOption3: 'Niveau 3 · 3 600 $',
    tierOption4: 'Niveau 4 · sur devis',
    save: 'Enregistrer',
    saving: 'Enregistrement…',
    saveError: 'Échec, réessaie.',
    saved: 'Enregistré ✓',
    galleryLink: 'Voir la galerie →',
    previewHeading: 'Aperçu du carton de partage',
    previewHint:
      'Voici ce qu’afficheront Slack, iMessage, etc. quand quelqu’un colle le lien de cette session. L’aperçu reflète la version *publiée*. Enregistre pour le voir bouger.',
    previewDisabledHint:
      'Active la vitrine et enregistre : l’aperçu apparaîtra ici une fois la session publiée.',
    previewOpenInTab: 'Ouvrir le PNG',
  },

  adminShowcaseOverview: {
    eyebrow: 'vitrine · vue d’ensemble',
    title: 'Toutes les vitrines, d’un coup d’œil',
    sub: 'Vérifie la cohérence visuelle des cartes sociales avant qu’elles ne sortent. Titre trop long, sous-titre manquant, tier non assigné : tout est repéré ici.',
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
    pageTitle: 'Le parcours complet, de l’idée au paiement',
    metaDescription:
      'Le parcours complet, étape par étape : de ta première visite jusqu’au projet livré et payé. 12 étapes. Tu en fais la moitié. Ton temps total : ~20 minutes.',
    backHome: '← Retour à l’accueil',
    eyebrow: 'le parcours complet',
    title: 'De la première visite au projet livré et payé',
    sub: 'Chaque étape détaillée : qui fait le geste, à quel moment, combien de temps ça prend.',
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
            body: 'Pas de compte requis. Tu lis la vibe, les prix publics, les projets en cours. Si rien ne matche, tu repars. Pas de frais, pas de drame.',
          },
          {
            num: '02',
            actor: 'you',
            duration: '5–10 min',
            where: 'portail',
            title: 'Tu décris ton problème',
            body: 'Formulaire guidé. Pas un call. Sauvegarde automatique : tu pars manger, tu reviens, ton brouillon est là. Tu peux même dessiner un croquis si les mots manquent.',
          },
          {
            num: '03',
            actor: 'you',
            duration: '1 clic',
            where: 'ton courriel',
            title: 'Le lien de connexion arrive dans ta boîte',
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
            body: 'Pas d’IA entre toi et moi. Je lis chaque formulaire moi-même, en français ou en anglais. Dans ta langue, je réponds dans ta langue.',
          },
          {
            num: '05',
            actor: 'me',
            duration: 'async',
            where: 'fil de session',
            // frPunct() keeps ":" and the « » glued to their words
            // at render time (a literal U+00A0 does not survive the build).
            title: 'Je réponds : oui, non, ou « raconte-moi plus »',
            body: 'Si c’est oui, un devis ferme s’écrit dans ton portail. Si c’est non, je te redirige vers un patron Niveau 0 gratuit, ou vers un dev qui matche mieux. Entre les deux, je pose mes questions.',
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
            body: 'Niveau 1 : 750 $ en plein. Niveau 2 : 900 $ de dépôt (le solde à la livraison). Niveaux 3-4 : premier versement (Niveau 4 sur devis). Reçu officiel automatique par Stripe.',
          },
          {
            num: '07',
            actor: 'me',
            duration: 'dès le jour 2',
            where: 'portail',
            title: 'Démo testable en continu',
            body: 'Je push chaque jour. Tu cliques quand tu veux voir où on en est. Pas besoin d’attendre une réunion de mise à jour. Il n’y en a pas.',
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
            title: 'Je livre, ton projet devient une page publique',
            body: 'Le build vit en ligne. Option : cacher tes données commerciales (noms de clients, chiffres) avant publication. Toi seul décides ce qui est public.',
          },
          {
            num: '10',
            actor: 'you',
            duration: '1 min',
            where: 'Stripe',
            title: 'Tu paies le solde',
            body: 'Niveau 2 : les 900 $ qui restent. Niveaux 3-4 : le versement suivant. Reçu officiel Stripe : c’est ce qui sort sur ta compta.',
          },
          {
            num: '11',
            actor: 'both',
            duration: '7 jours',
            where: 'portail',
            title: 'Une ronde de retouches incluse (Niveau 2+)',
            body: 'Tu testes en vrai pendant une semaine. Tu reviens avec une liste de petits ajustements. Je polis. Inclus dans le prix.',
          },
          {
            num: '12',
            actor: 'you',
            duration: 'à toi de choisir',
            where: 'page Mon compte',
            title: 'Handoff ou mode Dépositaire',
            body: 'Tu prends tout à ton nom (repo, domaine, comptes) OU tu me laisses garder les clés : Watch (120 $/an) ou Care (400 $/an, avec 2 h/an de retouches). Annulable n’importe quand, avec bascule automatique vers « Tout à toi ».',
          },
        ],
      },
    ],
    outro: {
      title: 'C’est tout.',
      body: 'La plupart de tes gestes prennent une minute. Tout le reste se passe pendant que tu fais autre chose. C’est ça, le contrat.',
      cta: 'Décris ton problème →',
    },
  },

  vouches: {
    pageTitle: 'Recommandations',
    eyebrow: 'témoignages',
    heading: 'Quelques mots de gens qui ont travaillé avec moi',
    lead: 'Le portail est rapide à essayer ; ces témoignages aident à savoir si on va cliquer ensemble.',
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
      // frPunct() keeps the "?" glued to "moi" at render time
      // (a literal U+00A0 does not survive the build).
      heading: 'Tu as déjà travaillé avec moi ? Dis-le en quelques phrases.',
      lead: 'Court, honnête, à ta voix. Je relis avant que ça paraisse : coquilles, longueur, ton. Ton courriel reste en privé : c’est seulement pour pouvoir te recontacter si je dois ajuster un mot.',
      forProjectPrefix: 'Tu témoignes à propos du projet ',
      forProjectLink: 'ouvrir le projet',
      forProjectSuffix: ', il sera affiché sur sa page une fois approuvé.',
      privacy:
        'Ton nom et tes mots seront visibles publiquement. Ton courriel ne sera jamais affiché.',
      successHeading: 'Reçu. Merci.',
      successBody:
        'Je relis dans les prochains jours. Si c’est bon tel quel, ça paraît sans autre étape. Si je veux resserrer un mot, je t’écris.',
      submitAnother: 'Soumettre un autre témoignage',
      backHome: '← Retour à l’accueil',
      backToProject: '← Retour au projet',
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
        linkHint: 'Ton site, LinkedIn, GitHub, affiché à côté de ton nom.',
      },
      submitButton: 'Envoyer',
      submitting: 'Envoi…',
      errors: {
        rateLimit: 'Trop d’envois récents, réessaie dans une heure.',
        invalidName: 'Nom invalide : 2 à 80 caractères.',
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
    mapEyebrow: 'un coin de la carte',
    mapHere: 'tu es ici… en fait non',
    mapHome: 'L’accueil',
    mapProjects: 'Les projets',
    mapAtlas: 'La carte du site',
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
      pricing: 'Pricing',
      vibe: "What I do / don't",
      about: 'About',
    },
  },

  brandTitle: '№ 01 · Marc, Québécois dev',
  tabAway: '👋 come back · Marc',
  metaDescription:
    'Marc, a Québécois dev. Evenings and weekends, I help people solve everyday problems with code. Everything runs async, no meetings, at your pace.',

  hero: {
    eyebrow: 'side-practice · Quebec · async',
    folio: '№ 01 · Marc, a Québécois dev',
    salut: 'Marc-Antoine, here to solve important problems for my community',
    display: {
      pre: 'Marc-Antoine,',
      lead: 'here to solve',
      emphasis: 'important problems',
      tail: 'for my community.',
    },
    signature: 'Marc, Québécois dev',
    body2:
      "There's something that comes back every week. Paperwork you keep re-typing, a thread that gets lost, people to wrangle. It's no national crisis, but it's annoying enough to deserve better. Tell me about it.",
    cta: 'Create a free account →',
    ctaWaitlist: 'Join the waitlist →',
    ctaLoggedIn: 'Start a new proposal →',
    mySessionsLink: 'View my sessions',
    // Split so the language word ("French") renders as a link that
    // switches the page to that language. See Hero.tsx.
    bilingual: { pre: '(Also in ', link: 'French', post: ', I reply in your language.)' },
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
        body: 'You fill out a guided form. No call to schedule. It saves itself as you go, so you can close the tab and come back to a saved draft whenever you like.',
      },
      {
        num: '02',
        title: 'I reply within 72h',
        body: "Yes, no, or 'tell me more.' I read every form myself. No AI between you and me.",
      },
      {
        num: '03',
        title: 'You watch the work live',
        body: 'Testable demo from day 2. There’s no status meeting to wait for, because everything lives in the portal.',
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
    sub: 'Behind each card is a project that’s actually running. Code in production, concrete problems, and a build you can go test right now.',
    seeAll: 'See all projects →',
    galleryCard: {
      eyebrow: 'want to see everything?',
      title: 'The full gallery, every project',
      body: 'Beyond the three cards above, the gallery filters by tier and by status. Each card opens the project detail with the live build embedded.',
      cta: 'See all projects →',
    },
    loading: 'Loading…',
    openBuild: 'Open the build ↗',
    untitled: 'Untitled project',
    currentBuildLabel: 'Current build',
    noBuildYet: 'No pinned build yet',
    tierPrefix: 'Tier',
    emptyTitle: 'The first project lands here very soon.',
    emptyBody:
      'No published projects yet, the gallery is new. You can still see how it works, or open the first one through the portal.',
    emptyCta: 'Describe your problem →',
    errorTitle: 'Can’t load the projects right now.',
    errorBody: 'You can still open the full gallery, or write through the portal.',
  },

  featuredTestimonials: {
    eyebrow: 'social proof',
    title: 'A few words from people who worked with me',
    sub: 'Short vouches, submitted by actual collaborators. I read before they ship and may tighten the wording, but the substance is their voice.',
    writeOne: 'Worked with me? Write a vouch →',
    galleryCard: {
      eyebrow: 'want to read everything?',
      title: 'All vouches, on one page',
      body: 'The full list lives on /vouches: chronological, unfiltered, with each person’s name and link.',
      cta: 'See all vouches →',
    },
  },

  vibe: {
    eyebrow: 'catch the vibe',
    title: 'What I do, what I don’t',
    body: "Read this before filling out the form. If it matches, we'll get along. If not, no drama. There are plenty of other devs who do other things.",
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

  bringAnything: {
    eyebrow: 'no idea too small',
    title: 'Bring me anything',
    body: "I want every idea to land in my inbox: small, weird, half-formed, doesn't matter. My job is to filter. Yours is just to describe whatever's been rattling around in your head.",
    examplesTitle: "Ideas I'd happily take",
    examples: [
      'Your truck voice-notes → a draft invoice waiting for you Sunday morning',
      "A one-page site for your partner's 30th birthday with a note from each friend",
      'A tool to help your grandma organize her recipes',
      'A "days without…" counter (cigarettes, video games, whatever)',
      'A memorial page with photos for your cat who passed',
      'A catalog of the inside jokes in your friend group',
      'A calculator that solves exactly ONE problem in your job',
      'A kitchen dashboard (weather, todo, birthdays)',
      'An interactive map of good coffee shops along Route 132',
    ],
    reassure:
      "If it's too small for my pricing, I'll show you how to do it yourself (Tier 0, free). Too big or somewhere in between, we talk it through and I triage. Either way, I want to see it before I decide.",
    cta: 'Describe your idea →',
  },

  pricing: {
    eyebrow: 'public pricing',
    title: 'What it costs',
    body: 'Concrete prices, no hidden quotes. Each tier (price level) links to actual past projects of the same level. You see what it looks like before you submit.',
    asOf: 'Public prices, effective 2026-06-01.',
    disclaimer:
      'Prices are fixed before we start. No surprise after: if I run over, that’s on me. Taxes extra where applicable.',
    custodianNote:
      'Custodian mode: after delivery, I keep the site online and up to date. Two annual plans: Watch ($120/yr) or Care ($400/yr, with 2h/yr of tweaks). Bigger changes are billed at $75/hr. You can opt for "All yours" instead if you’d rather manage it yourself.',
    custodianNoteHeading: 'After delivery, then what?',
    custodianNoteCta: 'How it ends →',
    rescueNoteHeading: 'Already have something?',
    rescueNote:
      "An AI-generated app that keeps crashing, a site left half-done, old code nobody wants to touch. I start by looking at what's wrong (scoping report, $250, credited to the repair), then fix it or bring it up to date. The price for the repair I give you after, once I know what I'm dealing with.",
    rescueNoteCta: 'Describe what you have →',
    tiers: [
      {
        name: 'Tier 0',
        price: 'Free',
        scope:
          'Your problem is too small to hire a dev. I redirect you to a similar pattern (a ready-made recipe) or a no-code template.',
        example:
          'e.g. neighbourhood snow-shovel rotation, or a party RSVP: pick a recipe, you’re done.',
        after: 'self-service',
      },
      {
        name: 'Tier 1',
        price: '$750',
        scope:
          'A working thing, hosted and handed over running. Not a demo you have to keep alive yourself. One clear deliverable: a form, a script, an automation, a one-pager. No login, no multi-user.',
        example: 'e.g. a web form that drops straight into your spreadsheet, no retyping.',
        after: 'paid in full',
      },
      {
        name: 'Tier 2',
        price: '$1,800',
        scope:
          'A small tool. A few screens, some data, maybe one login. Paid in two halves: $900 to start, $900 at delivery.',
        example: 'e.g. your truck voice-notes turned into a Sunday-morning draft invoice.',
        after: '50 / 50',
      },
      {
        name: 'Tier 3',
        price: '$3,600',
        scope:
          'A tool that lasts. A real data model, a login, multiple users. Paid in installments (50/50 or 40/40/20).',
        example: 'e.g. a tailored management tool for your small team.',
        after: 'in installments',
        anchor: true,
      },
      {
        name: 'Tier 4',
        price: 'from $7,500',
        scope:
          'A platform. Bigger, multi-role. Custom-quoted after triage (the step where I read it and decide).',
        example: 'e.g. a platform for a co-op, or a tool for a whole team.',
        after: 'post-triage quote',
      },
    ],
  },

  cta: {
    eyebrow: 'ready?',
    title: 'Describe your problem',
    body: "Free account. No call. I read every form myself and reply within 72h: yes, no, or 'tell me more.'",
    button: 'Open the form →',
    buttonLoggedIn: 'Start a new proposal →',
    micro: "If I'm full, you can still create an account and join the waitlist.",
  },

  stickyCta: {
    label: 'Start a session',
    short: 'Start →',
    ariaLabel: 'Start a session, open the form',
    farLabel: 'Almost there →',
    dismissLabel: 'Hide',
    pebbleAriaLabel: 'Resume, start a session',
  },

  themeToggle: {
    switchToDay: 'Day mode',
    switchToNight: 'Night mode',
  },

  napkin: {
    eyebrow: 'on a napkin',
    title: 'Sketch me the problem',
    instruction: 'A box, two arrows, a word, anything that helps me understand.',
    descLabel: 'In one sentence, what is it?',
    descPlaceholder: "e.g. 'My café wants to know who works which shifts.'",
    loadingCanvas: 'Loading the whiteboard…',
    homeTeaser: 'Prefer to draw? The napkin lives in the form →',
    formTeaser: 'Words not landing? Sketch it →',
    formReopen: 'Sketch attached, view or edit →',
    formHide: 'Hide the sketch',
    formRemove: 'Remove the sketch',
    pillView: 'View sketch',
    sceneOpen: 'Open the interactive sketch →',
    sceneHide: 'Hide the interactive sketch',
    replayPlay: 'Replay the sketch ▶',
    replayDrawing: 'Drawing…',
  },

  media: {
    voice: {
      record: 'Record a voice note',
      recording: 'Recording',
      stop: 'Stop',
      rerecord: 'Re-record',
      cancel: 'Cancel',
      retry: 'Try again',
      working: 'One sec…',
      error:
        "Couldn't reach the microphone. Check the browser permission, or just type it instead.",
    },
    compose: {
      voiceTrigger: '🎙 Voice note',
      sketchTrigger: '✎ Sketch',
      voiceConsent:
        'Uses your microphone. The clip is attached to this message and transcribed so it stays searchable.',
      voiceAttach: 'Attach voice note',
      sketchAttach: 'Attach sketch',
      sketchCancel: 'Cancel sketch',
      sketchHint:
        'A quick scribble often says more than a paragraph. It attaches straight to your message.',
      voiceChip: 'Voice note',
      sketchChip: 'Sketch',
      processing: 'Adding…',
    },
    thread: {
      voiceLabel: 'Voice note',
      transcriptLabel: 'Transcript',
      transcriptPending: 'Transcript unavailable.',
      sketchLabel: 'Sketch',
      sketchOpen: 'Open the sketch',
      sketchClose: 'Hide the sketch',
    },
    intake: {
      voiceTeaser: 'Rather say it out loud? Record a voice note →',
      voiceReopen: 'Voice note recorded, review →',
      voiceHide: 'Hide the voice note',
      voiceRemove: 'Remove the voice note',
      voiceConsent:
        'Uses your microphone. The clip is transcribed on Cloudflare and immediately discarded. Only the text below is kept with your intake.',
      voiceUse: 'Transcribe it',
      title: 'Say the problem out loud',
      transcriptLabel: 'What I heard (edit if needed)',
      transcriptPlaceholder: 'Your transcribed words appear here…',
    },
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
    title: "Pick the kind of problem, I'll take it from there",
    sub: "One click and you'll skip the 'project type' step in the form. You can change your mind later.",
    types: {
      paperasse: 'Paperwork to automate',
      suivi: 'Tracking (clients, inventory, projects)',
      coordination: 'Coordination (team, volunteers, neighbours)',
      autre: 'Other, describe it in your own words',
      rescue: 'Fix something that already exists',
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
    slugs: ['price', 'diy-ai', 'timeline', 'result', 'unclear', 'ownership', 'bring-own'] as const,
    items: [
      {
        q: 'Is the price really that price?',
        a: "Yes. Tier 0 is $0 and exists so we can see if we're a fit. Tiers 1–3 are fixed-price quoted before we start, and I won't go past the quote without a conversation first. No surprise invoice. The official receipt comes from Stripe: that's normal, it's my payment processor.",
      },
      {
        q: "Couldn't I just build this myself with an AI app builder?",
        a: "For a Tier 0 problem, you probably can, and I'll point you to a builder or a template for free, which is what Tier 0 is for. For anything bigger, the building was never the hard part. An AI builder needs you to know exactly what to ask it, and most people don't yet. Figuring that out is the triage. It gets you a quick demo, then leaves you stuck on the login that half-works, the data that goes missing, the hosting, the domain. You'd be the one debugging at 9pm with nobody to call. What you pay me for is a fixed price, a data model that holds up when it's really used, and a name that's accountable when something breaks months later. Already stuck with a half-working AI build? That's a <a href=\"/en/intake\">rescue</a>: I look at it and tell you straight whether it's worth fixing. If your idea is small enough that none of that bites, use the builder, I'll tell you so honestly.",
      },
      {
        q: 'What if it takes longer than expected?',
        a: "If I run over, that's on me: the price stays what was quoted. If the scope changes mid-flight (you're adding new things), we pause, look at it, and decide together: adjust the quote or cut.",
      },
      {
        q: "What if I don't like the result?",
        a: "You see a testable demo at every step, not just at the end. If halfway through you realize it's not what you wanted, we stop. I bill for the work done to date, not a penny more. No obligation to finish.",
      },
      {
        q: "I don't know exactly what I want. Is that ok?",
        a: 'It\'s expected. Describe it the way it comes, in your own words. Don\'t pre-filter. If it sounds too small, too weird, or not "professional enough," write it anyway. I decide what fits. My job is to ask the right questions and put a concrete version in front of you to react to.',
      },
      {
        q: 'Who owns the code at the end?',
        a: "Yours either way. Two modes: 'All yours' (you hold the repo, domain, and accounts from day 1) or 'I handle it' (I'm custodian of the keys, transferable on demand, no fee, in about a week). Neither traps you. <a href=\"/en/handoff\">See how it ends →</a>",
      },
      {
        q: 'Can I bring my own designs or mockups?',
        a: 'Please do. Figma, Sketch, napkin sketch, all welcome. Otherwise, I propose a simple visual direction and we adjust together.',
      },
    ],
  },

  about: {
    eyebrow: 'who I am',
    title: 'About',
    body: "I've been a dev for ~10 years. Full-time day job (37.5h/week), a family, and a desire to help small businesses and people around me simplify their lives without paying an agency. The portal is what makes that possible, for both of us.",
    body2:
      'It’s one person making the calls, with just enough machine in the middle to handle the logistics. Not an agency, not some sprawling platform. That’s what keeps the evenings ours, yours and mine.',
    portraitAlt: 'Marc',
    githubLabel: 'GitHub',
  },

  footer: {
    contact: {
      pre: 'Contact: ',
      link: 'start a session',
      post: ' and we’ll talk it through there. Beyond that, I’m not reachable.',
    },
    legal: 'Hosted in Canada · Bill 25 · OQLF',
    copyright: '© Marc 2026',
  },

  pullQuote: {
    body: 'I’ll always be honest about your project, even when the answer is “keep your money.”',
    attribution: 'Marc',
  },

  engagement: {
    statusBarLabel: 'Engagement stage',
    demoNotice: 'EXAMPLE · engagement in progress',
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
        'Not deployed yet. The preview appears here from day 5 (typical Tier 2 engagement).',
    },
    thread: {
      title: 'Engagement thread',
      body: 'All the communication holds here, in chronological order. Nobody has to dig through email or book a meeting to find out where things stand.',
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
      body: "This URL doesn't match any public engagement. If you're a client, check your link. Otherwise, back to home.",
    },
  },

  tier0: {
    pageTitle: 'Tier 0 · free tools for smaller problems',
    metaDescription:
      'Free patterns for everyday problems too small to hire a dev: snow rotation, RSVP, hours tracking, neighbour lending.',
    backHome: '← Back home',
    eyebrow: 'Tier 0 · self-service · free',
    title: "Your problem is too small to hire a dev. Here's how to handle it yourself",
    intro:
      "No shame. If your budget is under $750 and your problem fits one of these 4 categories, here's the recipe. You don't need to buy anything and you don't need me.",
    problemLabel: 'The problem',
    recipeLabel: 'The recipe',
    growBack:
      "If one of these patterns isn't enough anymore, your problem grew. Good news: it's probably Tier 1 or 2 now. Tell me about it.",
    intakeCta: 'My problem grew → open the form',
  },

  intake: {
    pageTitle: 'Describe your problem · form',
    metaDescription:
      "Intake (project request) form for Marc's side-practice. Async, at your pace. Auto-save. Reply within 72h.",
    backHome: '← Back home',
    mast: {
      eyebrow: 'Session intake',
      title: 'You’re describing a problem',
      lead: 'This isn’t a contact form. Filling it out opens a working session: a private thread where we take your problem from rough idea to a clear answer. Nothing sends until you submit, and every field autosaves as you type.',
    },
    draftPrompt: {
      title: 'A draft is saved',
      body: 'You started an intake on this device. Pick up where you left off, or start over.',
      continueBtn: 'Continue draft',
      freshBtn: 'Start fresh',
      summary: (savedAt: string) => `Last edited: ${savedAt}.`,
    },
    capacity: {
      atCap:
        "I'm full right now. You can still submit: I'll put you on the waitlist and reply when a slot opens.",
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
      // Quirky swap-in shown after the visitor ticks the box — same
      // checkbox, warmer text. Non-blocking: the CTA always works.
      ackThanks: '✓ Thanks for reading, you got the vibe.',
      cta: 'Continue →',
    },
    account: {
      eyebrow: 'free account',
      title: 'I just need an email',
      body: "That's it. No password while you fill the form. If you come back later, I'll send a sign-in link by email to resume. No account to create, no password to invent. Your draft auto-saves on every field.",
      emailLabel: 'Email',
      nameLabel: 'First name (optional)',
      namePlaceholder: 'Marie',
      hint: 'Marc reads every form himself. No spam, no resale.',
      autosaveNote: '✓ No pressure, your draft will be here if you come back.',
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
      body: "Pick the closest one. If nothing matches, choose 'other': Marc reads it personally and reroutes if needed.",
    },
    form: {
      eyebrow: 'the details',
      autosaved: '✓ Auto-saved on every field',
      back: '← Change type',
      continue: 'Submit →',
      handoffMode: {
        label: 'Management preference (optional)',
        hint: "At delivery, who holds the keys? By default Marc handles it (annual plan), which saves you from managing DNS, Cloudflare, Resend yourself. Can change later; 'All yours' requires an explicit confirmation at delivery.",
        learnMore: 'See how it ends →',
        optionJe: 'I handle it: Marc keeps the keys (annual plan, recommended)',
        optionTout: 'All yours: I manage DNS, Cloudflare, Resend myself',
        optionParle: "Let's talk later",
      },
    },
    confirmation: {
      eyebrowAccepted: 'received',
      eyebrowWaitlist: 'received · waitlist',
      titleAccepted: "Thanks, it's received.",
      titleWaitlist: "Thanks, you're on the waitlist.",
      bodyAccepted:
        "I read every form myself. No AI between you and me. You'll get an honest reply in 72h, by email: yes, no, or 'tell me more.'",
      bodyWaitlist:
        "I'm full right now: 1 active build + 1 in triage, which is my cap, to respect my family time. I'll reply as soon as a slot opens, usually a few weeks. Your draft stays saved.",
      sla: "Honest reply in 72h: yes, no, or 'tell me more.'",
      summaryTitle: 'What you sent me',
      summaryEmail: 'Email',
      summaryName: 'First name',
      summaryType: 'Problem type',
      summarySubmittedAt: 'Submitted on',
      summaryAnswers: 'Your answers',
      startOver: 'Start a new form',
      submitting: 'Sending…',
      submitError:
        'Connection hiccup while sending your intake. Your draft is saved, try again in a moment.',
      sessionLinkLabel: 'See your session →',
      sessionLinkHint: 'Your proposal is saved. You can follow it and reply here.',
      sessionEditHint: 'You can edit your answers anytime from your portal ("My sessions").',
      magicLinkSentTitle: 'Check your email to finish',
      magicLinkSentBody: (email: string) =>
        `I sent a sign-in link to ${email}. Open it to access your session. It expires in 30 minutes.`,
      magicLinkAgain: "Didn't get it? Resend the link",
      parkedStripHint: 'Your form is parked, it kicks off as soon as you sign in.',
    },
  },

  sessionAdvancements: {
    heading: 'Build advancements',
    subtitle:
      'Build milestones with a link to the matching Cloudflare deployment. Each entry is a build you can open.',
    loading: 'Loading…',
    empty: 'No advancements posted yet.',
    currentLabel: 'Current build',
    formEyebrow: 'Post an advancement',
    formLabel: 'Title',
    formLabelPlaceholder: 'Rev 1 · first testable demo',
    formBody: 'Description',
    formBodyPlaceholder: "What changed in this build, what's worth poking at.",
    formIframePath: 'Iframe path (optional)',
    formIframePathPlaceholder: '/me, /projects, etc.',
    formIframePathHint:
      'Site-relative (starts with /). Empty = deploy root. Used to focus the iframe on the most relevant page.',
    formBuildUrl: 'Build URL (optional)',
    formBuildUrlPlaceholder: 'https://marcportal.com/projects',
    formBuildUrlHint:
      'For a build hosted elsewhere (different repo or Cloudflare project). Empty = auto-stamp on the portal’s next deploy.',
    formFlags: 'Visibility',
    flagAllowedForPublic: 'Visible publicly',
    flagShowInConversation: 'Show in the conversation',
    flagShowAsCurrentBuild: 'Pin as "current build"',
    formSubmit: 'Post',
    formSubmitting: 'Posting…',
    formStampHint: 'The Cloudflare URL and commit are added automatically on the next deploy.',
    formError: 'Failed, try again.',
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
    testimonials: {
      eyebrow: 'vouches',
      heading: 'Words from people who touched this project',
      empty: 'No vouches for this project yet.',
      ctaTitle: 'Did you touch this project?',
      ctaBody:
        'If Marc helped on this specific project, say it in a few sentences, it’ll appear here.',
      ctaButton: 'Write a vouch →',
    },
  },

  projects: {
    eyebrow: 'projects',
    heading: 'Projects in flight',
    intro:
      'Sessions I’m publishing to the public, each a living project with its latest build open for inspection.',
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
    placeholderIntro: 'At any tier, a starting line.',
    placeholderT0Cta: 'Browse Tier 0 →',
    placeholderIntakeCta: 'Start the intake →',
  },

  showcaseAdmin: {
    sectionHeading: 'Showcased projects',
    sectionHint:
      'When you turn this on, this session appears on /projects with the title and tagline you set here.',
    enabledLabel: 'Publish as a project on /projects',
    titleLabel: 'Project title (optional)',
    titlePlaceholder: 'Truck Notes · voice → invoice',
    taglineLabel: 'Short tagline (optional)',
    taglinePlaceholder: 'Truck voice notes → draft invoice by Sunday morning.',
    tierLabel: 'Tier',
    tierHint: 'Position the session against the public pricing tiers.',
    tierOptionNone: 'Unclassified',
    tierOption0: 'Tier 0 · self-service',
    tierOption1: 'Tier 1 · $750',
    tierOption2: 'Tier 2 · $1,800',
    tierOption3: 'Tier 3 · $3,600',
    tierOption4: 'Tier 4 · quoted',
    save: 'Save',
    saving: 'Saving…',
    saveError: 'Failed, try again.',
    saved: 'Saved ✓',
    galleryLink: 'See the gallery →',
    previewHeading: 'Share-card preview',
    previewHint:
      "Here's what Slack, iMessage, etc. will show when someone pastes this session's link. The preview reflects the *published* version. Hit save to refresh it.",
    previewDisabledHint:
      'Turn on the showcase and save: the preview will appear here once the session is published.',
    previewOpenInTab: 'Open PNG',
  },

  adminShowcaseOverview: {
    eyebrow: 'showcase · overview',
    title: 'Every showcase, at a glance',
    sub: 'Brand-consistency check before cards go out into the world. Too-long titles, missing taglines, un-tiered sessions: all flagged here.',
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
    pageTitle: 'The full journey, from idea to paid',
    metaDescription:
      'The full journey, step by step: from your first visit to a shipped, paid project. 12 steps. You do half of them. Your total time: ~20 minutes.',
    backHome: '← Back home',
    eyebrow: 'the full journey',
    title: 'From your first visit to a shipped, paid project',
    sub: 'Every step in detail: who makes the move, when, and how long it takes.',
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
            body: 'No account needed. Read the vibe, the public prices, the projects in progress. If nothing matches, you walk away. No charge, no drama.',
          },
          {
            num: '02',
            actor: 'you',
            duration: '5–10 min',
            where: 'portal',
            title: 'You describe your problem',
            body: 'Guided form. Not a call. Auto-save: eat dinner, come back, your draft is right where you left it. You can even sketch a napkin if words fall short.',
          },
          {
            num: '03',
            actor: 'you',
            duration: '1 click',
            where: 'your inbox',
            title: 'A sign-in link lands in your inbox',
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
            body: 'No AI between you and me. I read every form myself, in French or English. You write in your language, I reply in your language.',
          },
          {
            num: '05',
            actor: 'me',
            duration: 'async',
            where: 'session thread',
            title: 'I reply: yes, no, or "tell me more"',
            body: 'If yes, a fixed-price quote goes in your portal. If no, I redirect you to a free Tier 0 recipe, or to a dev who fits better. In between, I ask my questions.',
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
            body: 'Tier 1: $750 in full. Tier 2: $900 deposit (balance at delivery). Tiers 3-4: first installment (Tier 4 quoted). Official receipt auto-issued by Stripe.',
          },
          {
            num: '07',
            actor: 'me',
            duration: 'from day 2',
            where: 'portal',
            title: 'Testable demo, continuously',
            body: 'I push every day. You click whenever you want to see where we are. No status meeting to wait for. There aren’t any.',
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
            title: 'I ship, and your project becomes a public page',
            body: 'The build goes live. Option: redact your commercial data (client names, numbers) before publishing. You alone decide what’s public.',
          },
          {
            num: '10',
            actor: 'you',
            duration: '1 min',
            where: 'Stripe',
            title: 'You pay the balance',
            body: 'Tier 2: the remaining $900. Tiers 3-4: the next installment. Official Stripe receipt: the one that shows up in your bookkeeping.',
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
            body: 'Take everything in your name (repo, domain, accounts) OR let me hold the keys: Watch ($120/yr) or Care ($400/yr, with 2h/yr of tweaks). Cancel anytime, with an auto-flip to "All yours".',
          },
        ],
      },
    ],
    outro: {
      title: 'That’s it.',
      body: 'Most of your moves take a minute. Everything else happens while you do something else. That’s the deal.',
      cta: 'Describe your problem →',
    },
  },

  vouches: {
    pageTitle: 'Vouches',
    eyebrow: 'testimonials',
    heading: 'A few words from people who worked with me',
    lead: 'The portal is quick to try; these vouches help you decide if the contact fits.',
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
      lead: "Short, honest, in your voice. I read before it ships: typos, length, tone. Your email stays private: it's only so I can reach back out if I need to tweak a word.",
      forProjectPrefix: 'You’re vouching about the project ',
      forProjectLink: 'open the project',
      forProjectSuffix: ', it’ll appear on the project page once approved.',
      privacy: 'Your name and your words will be public. Your email will never be displayed.',
      successHeading: 'Got it, thanks.',
      successBody:
        'I read in the next few days. If it’s good as-is, it ships without another step. If I want to tighten a word, I’ll email you.',
      submitAnother: 'Submit another vouch',
      backHome: '← Back home',
      backToProject: '← Back to project',
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
        linkHint: 'Your site, LinkedIn, GitHub, shown next to your name.',
      },
      submitButton: 'Send',
      submitting: 'Sending…',
      errors: {
        rateLimit: 'Too many recent submissions, try again in an hour.',
        invalidName: 'Invalid name: 2 to 80 characters.',
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
    mapEyebrow: 'a corner of the map',
    mapHere: 'you are here… actually, no',
    mapHome: 'Home',
    mapProjects: 'Projects',
    mapAtlas: 'The site map',
  },

  errorBoundary: {
    title: 'Something went sideways',
    body: "This page didn't load. Most likely a deploy raced your navigation. Refresh; if it sticks, write to me.",
    refreshCta: 'Refresh',
    homeCta: '← Back home',
  },
}

export const DICT: Record<Lang, Copy> = { fr: FR, en: EN }
