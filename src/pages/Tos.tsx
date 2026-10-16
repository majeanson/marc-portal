import type { Lang } from '../i18n'
import { Header } from '../components/Header'
import { Footer } from '../components/Footer'
import { FeatureContinue } from '../components/FeatureContinue'
import { FeatureFolioLink } from '../components/FeatureFolioLink'
import { PAGE_FEATURE } from '../lib/features'
import { PAGE_FOLIOS } from '../lib/folios'
import { usePageMeta } from '../lib/usePageMeta'

/**
 * Terms of service. Companion to /confidentialite: that page says what happens
 * to your data, this one says what happens to your money and your code.
 *
 * Sections 2 to 8 restate what the site already says elsewhere (prices in
 * i18n.ts `pricing`, the Stripe schedule in the journey steps, the manual
 * refund flow in PaymentActions, the ownership FAQ, the active-build cap in
 * functions/_lib/sessions.ts). When one of those sources changes, this page
 * changes with it (see Tos.feature.json).
 *
 * Marc has NOT yet confirmed these clauses, which are new drafting and not
 * restated from anywhere: the contract-starts-at-first-payment line (2), the
 * reuse-my-own-tooling carve-out (7), the "you grant me the right to use what
 * you send" line (9), the liability cap (10), the decline-or-stop-a-project
 * right (12), accepted-projects-keep-their-terms (13), and the governing-law
 * choice (14). Also not lawyer-reviewed: a Quebec lawyer should read the page
 * before anyone treats it as binding. Tracked in Tos.feature.json.
 *
 * Same shell as Privacy.tsx (the `.privacy` CSS block) on purpose: two legal
 * pages that look alike read as one set.
 */

const COPY = {
  fr: {
    pageTitle: 'Conditions · Marc',
    title: 'Conditions d’utilisation',
    intro:
      'Ce que tu peux attendre de moi, ce que j’attends de toi, et ce qui arrive à l’argent et au code. C’est court parce que la pratique est petite : une personne, un portail, des projets à la fois.',
    asOf: 'En vigueur : 2026-10-16. Dernière mise à jour : 2026-10-16.',
    sections: [
      {
        h: '1. Qui je suis',
        p: 'Je m’appelle Marc, je suis développeur au Québec et je travaille seul. Ces conditions s’appliquent entre toi et moi pour tout ce que tu fais sur ce portail. Pour me joindre : <a href="mailto:marc@marcportal.com">marc@marcportal.com</a>. Ce qui touche tes renseignements personnels est dans la <a href="/confidentialite">politique de confidentialité</a>.',
      },
      {
        h: '2. Ce que le portail fait',
        p: 'Tu décris ce que tu veux construire dans l’intake, je lis, puis je décide si ça rentre dans ma pratique et à quel niveau. Soumettre un intake ne t’engage à rien et ne m’engage à rien : c’est une demande, pas un contrat. Le contrat commence quand je t’accepte et que tu paies le premier versement.',
      },
      {
        h: '3. Combien de projets en même temps',
        p: 'Je mène deux builds actifs à la fois, pas plus. La file d’attente (le triage) n’a pas de plafond, donc ton projet peut attendre son tour. Je te dis où tu en es, mais je ne promets pas de date de départ avant d’avoir accepté ton projet.',
      },
      {
        h: '4. Les niveaux et les prix',
        p: 'Niveau 0, c’est gratuit et libre-service. Niveau 1 : 750 $. Niveau 2 : 1 800 $. Niveau 3 : 3 600 $. Niveau 4 : 7 500 $ et plus, soumis sur devis. Tout est en dollars canadiens, taxes en sus si elles s’appliquent. Le prix est figé avant qu’on commence : si le travail déborde, c’est sur moi. Les OBNL et les projets communautaires ont 20 % de moins sur les niveaux 1 à 4, appliqués à la main au triage.',
      },
      {
        h: '5. Les paiements',
        p: 'Tu paies par Stripe, sur leur page hébergée. Niveau 1 : le montant au complet au départ. Niveau 2 : 900 $ au départ, le solde à la livraison. Niveaux 3 et 4 : un premier versement, le reste selon ce qu’on a écrit ensemble. Le reçu officiel vient de Stripe, pas de moi. Le détail de ce que Stripe reçoit est à la <a href="/confidentialite#section-11">section 11 de la politique de confidentialité</a>.',
      },
      {
        h: '6. Les remboursements',
        p: 'Il n’y a pas de bouton de remboursement automatique. Tu m’écris, je regarde ce qui a été livré, et je te réponds sous 2 jours ouvrables. Chaque demande se règle à la main, au cas par cas, et je préfère qu’on en parle avant que ça s’envenime. Rien dans cette section ne limite ce que la loi te donne comme consommateur.',
      },
      {
        h: '7. À qui appartient le code',
        p: 'À toi, dans tous les cas. Tu as deux façons de finir. « Tout à toi » : tu détiens le dépôt, le domaine et les comptes dès le jour 1. « Je m’en occupe » : je garde les clés en dépositaire, je te les transfère sur demande, sans frais, en environ une semaine. Les détails et la liste de contrôle sont sur la page <a href="/handoff">handoff</a>. Je garde le droit de réutiliser mes propres outils et mon savoir-faire d’un projet à l’autre, mais pas ce qui est propre à ton projet.',
      },
      {
        h: '8. Le mode dépositaire',
        p: 'Si tu me laisses les clés, je garde ton site en ligne et à jour pendant que l’abonnement est actif. Tu peux l’annuler en tout temps depuis le portail client Stripe, accessible à partir de ta page <a href="/me">/me</a>. Pour reprendre la main, tu attestes savoir gérer les points de la liste de la page handoff : si tu coches sans les connaître et que le site casse, ce n’est pas un bogue que je répare gratuitement.',
      },
      {
        h: '9. Ce que j’attends de toi',
        p: 'Décris ton projet honnêtement, envoie seulement du contenu que tu as le droit d’utiliser, et ne cherche pas à contourner le portail (accès aux comptes des autres, tests de charge, scripts qui martèlent les formulaires). Ton adresse courriel est ta clé : la personne qui contrôle ta boîte contrôle ton compte, alors garde-la en sécurité. Tu me donnes le droit d’utiliser ce que tu m’envoies, uniquement pour faire le travail.',
      },
      {
        h: '10. Garanties et responsabilité',
        p: 'Je livre du travail soigné et testé, mais aucun logiciel n’est sans bogue, et je ne garantis pas que ton projet fera le résultat d’affaires que tu espères. Dans la mesure permise par la loi du Québec, ma responsabilité envers toi pour un projet se limite à ce que tu m’as payé pour ce projet. Cette limite ne s’applique pas à une faute intentionnelle ou lourde, ni à un dommage corporel, et elle ne retire aucun droit que la loi t’accorde.',
      },
      {
        h: '11. Disponibilité du portail',
        p: 'Le portail est tenu par une seule personne qui a aussi un emploi de jour. Je fais mon possible pour qu’il soit en ligne, mais je ne promets pas de disponibilité garantie. Une panne ou une maintenance ne te donne pas droit à une compensation, sauf si elle m’empêche de livrer ce que tu as payé.',
      },
      {
        h: '12. Y mettre fin',
        p: 'Tu peux arrêter quand tu veux : supprime ton compte depuis ta page <a href="/me">/me</a> (voir la <a href="/confidentialite#section-8">section 8 de la politique de confidentialité</a>) ou écris-moi. Les sommes déjà versées se règlent selon la section 6. De mon côté, je peux refuser ou arrêter un projet qui ne marche pas, en t’expliquant pourquoi et en réglant avec toi ce qui a été payé et ce qui a été fait.',
      },
      {
        h: '13. Changements',
        p: 'Si je change ces conditions de façon importante, je t’écris à l’adresse de ton compte avant que ça entre en vigueur. Les petites corrections (une faute, une clarification) sont datées en haut de la page sans avis individuel. Un projet déjà accepté garde les prix et les modalités en vigueur le jour où je l’ai accepté.',
      },
      {
        h: '14. Droit applicable',
        p: 'Ces conditions sont régies par les lois du Québec et du Canada qui s’y appliquent. Un litige qu’on n’arrive pas à régler à deux relève des tribunaux du Québec. Si ces conditions et la loi ne disent pas la même chose, c’est la loi qui gagne.',
      },
    ],
  },
  en: {
    pageTitle: 'Terms · Marc',
    title: 'Terms of service',
    intro:
      'What you can expect from me, what I expect from you, and what happens to the money and the code. It is short because the practice is small: one person, one portal, a couple of projects at a time.',
    asOf: 'Effective: 2026-10-16. Last updated: 2026-10-16.',
    sections: [
      {
        h: '1. Who I am',
        p: 'I’m Marc, a developer in Quebec, working alone. These terms sit between you and me for everything you do on this portal. To reach me: <a href="mailto:marc@marcportal.com">marc@marcportal.com</a>. What happens to your personal information is covered in the <a href="/en/privacy">privacy policy</a>.',
      },
      {
        h: '2. What the portal does',
        p: 'You describe what you want to build in the intake, I read it, then I decide whether it fits my practice and at which tier. Sending an intake commits neither of us: it is a request, not a contract. The contract starts when I accept you and you make the first payment.',
      },
      {
        h: '3. How many projects at once',
        p: 'I run two active builds at a time, no more. The waiting line (triage) has no ceiling, so your project may wait for its turn. I’ll tell you where you stand, but I don’t promise a start date until I’ve accepted your project.',
      },
      {
        h: '4. Tiers and prices',
        p: 'Tier 0 is free and self-serve. Tier 1 is $750. Tier 2 is $1,800. Tier 3 is $3,600. Tier 4 starts at $7,500 and is quoted. Everything is in Canadian dollars, plus tax where it applies. The price is locked before we start, and if the work runs over, that’s on me. Nonprofits and community projects get 20% off tiers 1 to 4, applied by hand at triage.',
      },
      {
        h: '5. Payments',
        p: 'You pay through Stripe, on their hosted page. Tier 1 is paid in full up front. Tier 2 is $900 up front with the balance at delivery. Tiers 3 and 4 start with a first installment and the rest follows what we wrote down together. The official receipt comes from Stripe, not from me. What Stripe receives is spelled out in <a href="/en/privacy#section-11">section 11 of the privacy policy</a>.',
      },
      {
        h: '6. Refunds',
        p: 'There is no automatic refund button. You write to me, I look at what has been delivered, and I answer within 2 business days. Each request is settled by hand, case by case, and I’d rather we talk before things sour. Nothing in this section limits what the law gives you as a consumer.',
      },
      {
        h: '7. Who owns the code',
        p: 'You do, either way. There are two ways to finish. “All yours”: you hold the repo, the domain and the accounts from day one. “I handle it”: I keep the keys as custodian and hand them over on request, free, in about a week. The details and the checklist are on the <a href="/en/handoff">handoff</a> page. I keep the right to reuse my own tooling and know-how from one project to the next, but nothing that is specific to yours.',
      },
      {
        h: '8. Custodian mode',
        p: 'If you leave me the keys, I keep your site online and up to date while the subscription is active. You can cancel it any time from the Stripe customer portal, reachable from your <a href="/en/me">/me</a> page. To take the keys back, you confirm you can handle the items on the handoff checklist: if you tick the box without knowing them and the site breaks, that is not a bug I fix for free.',
      },
      {
        h: '9. What I expect from you',
        p: 'Describe your project honestly, send only content you have the right to use, and don’t try to get around the portal (reaching other people’s accounts, load tests, scripts hammering the forms). Your email address is your key: whoever controls your inbox controls your account, so keep it safe. You give me the right to use what you send me, only to do the work.',
      },
      {
        h: '10. Warranty and liability',
        p: 'I deliver careful, tested work, but no software is free of bugs, and I can’t promise your project will produce the business result you’re hoping for. To the extent Quebec law allows, my liability to you for a project is capped at what you paid me for that project. The cap doesn’t apply to intentional or gross fault, or to bodily injury, and it takes away no right the law gives you.',
      },
      {
        h: '11. Portal availability',
        p: 'One person runs this portal, and that person also has a day job. I do my best to keep it up, but I don’t promise guaranteed uptime. An outage or maintenance window doesn’t entitle you to compensation, unless it stops me from delivering what you paid for.',
      },
      {
        h: '12. Ending things',
        p: 'You can stop whenever you like: delete your account from your <a href="/en/me">/me</a> page (see <a href="/en/privacy#section-8">section 8 of the privacy policy</a>) or write to me. Money already paid is settled under section 6. On my side, I can decline or stop a project that isn’t working, explaining why and settling with you what was paid and what was done.',
      },
      {
        h: '13. Changes',
        p: 'If I change these terms in a way that matters, I’ll write to your account address before it takes effect. Small fixes (a typo, a clarification) are dated at the top of the page without individual notice. A project I’ve already accepted keeps the prices and terms in force the day I accepted it.',
      },
      {
        h: '14. Governing law',
        p: 'These terms are governed by the laws of Quebec and the federal laws of Canada that apply there. A dispute we can’t settle between the two of us goes to the courts of Quebec. If these terms and the law disagree, the law wins.',
      },
    ],
  },
} as const

export function Tos({ lang }: { lang: Lang }) {
  const t = COPY[lang]

  usePageMeta({ title: t.pageTitle, lang })

  return (
    <div className="app">
      <Header lang={lang} />
      <main id="main-content">
        <article className="section">
          <div className="section__inner privacy">
            <FeatureFolioLink feature={PAGE_FEATURE['page.tos']} lang={lang} withDot>
              № {PAGE_FOLIOS.tos}
            </FeatureFolioLink>
            <h1>{t.title}</h1>
            <p className="privacy__intro">{t.intro}</p>
            <p className="mono privacy__asof">{t.asOf}</p>
            {t.sections.map((s) => {
              // Same anchor rule as Privacy.tsx: "N." in the heading becomes
              // #section-N so other pages can deep-link a clause.
              const m = /^(\d+)\./.exec(s.h)
              const id = m ? `section-${m[1]}` : undefined
              return (
                <section key={s.h} id={id} className="privacy__section">
                  <h2>{s.h}</h2>
                  {/* Hand-written <a> tags only; never feed user input through here. */}
                  <p dangerouslySetInnerHTML={{ __html: s.p }} />
                </section>
              )
            })}
          </div>
        </article>
      </main>
      <FeatureContinue page="page.tos" lang={lang} />
      <Footer lang={lang} />
    </div>
  )
}
