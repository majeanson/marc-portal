import { useEffect } from 'react'
import type { Lang } from '../i18n'
import { Header } from '../components/Header'
import { Footer } from '../components/Footer'

/**
 * Loi 25 (Quebec) / PIPEDA-aligned privacy policy. The footer claim "Hébergé
 * au Canada · Loi 25" needs a published policy with a designated person to be
 * structurally honest — this page is that.
 *
 * The eight Loi 25 obligations covered:
 *  1. Designated person responsible for protection (DPO contact)
 *  2. Information collected and purposes
 *  3. Consent + how to withdraw
 *  4. Right of access
 *  5. Right of rectification
 *  6. Right of erasure / portability
 *  7. Retention period
 *  8. Breach notification process
 */

const COPY = {
  fr: {
    pageTitle: 'Confidentialité — Marc',
    title: 'Politique de confidentialité',
    intro:
      'Cette page décrit comment ce portail traite tes renseignements personnels. C’est court parce que la pratique est petite : un humain (Marc), une base de données, des courriels transactionnels.',
    asOf: 'En vigueur : 2026-05-15. Dernière mise à jour : 2026-05-15.',
    sections: [
      {
        h: '1. Responsable',
        p: 'Marc est le responsable de la protection des renseignements personnels de ce portail (DPO de fait). Pour toute question, demande d’accès ou plainte : <a href="mailto:marc@marcportal.com">marc@marcportal.com</a>. Réponse en moins de 30 jours, comme l’exige la Loi 25.',
      },
      {
        h: '2. Renseignements collectés',
        p: 'Le portail collecte uniquement le strict nécessaire à la prestation du service : ton adresse courriel (pour la connexion par lien magique), le contenu de ton intake (le problème que tu m’apportes), nos messages échangés dans la session, et toute pièce jointe que tu déposes. Aucune analytique comportementale, aucun cookie tiers, aucun pixel marketing. Un outil de monitoring d’erreurs techniques (Sentry) est utilisé pour diagnostiquer les bogues — détails et minimisation à la <a href="#section-6">section 6</a>.',
      },
      {
        h: '3. Finalités',
        p: 'Ces données servent à : (a) t’authentifier sans mot de passe, (b) te permettre de suivre ta session, (c) que je puisse triager et livrer le travail. Elles ne sont ni revendues, ni utilisées pour de la prospection, ni partagées avec des tiers à des fins de marketing.',
      },
      {
        h: '4. Consentement',
        p: 'En soumettant l’intake, tu consens à la collecte et au traitement décrits ci-dessus. Tu peux retirer ton consentement en tout temps en supprimant ton compte (voir section 8) ou en m’écrivant — la session sera retirée du portail dans la même journée ouvrable.',
      },
      {
        h: '5. Hébergement et résidence des données',
        p: 'Tes données de session (intake, messages, pièces jointes, identité) vivent dans Cloudflare D1, région <code>enam</code> (Eastern North America, primaire à Toronto). Cloudflare peut répliquer en lecture vers d’autres régions pour la latence, mais l’écriture et la copie de référence restent au Canada. Trois services tiers reçoivent un sous-ensemble strictement limité : <strong>Resend</strong> (États-Unis) pour les courriels transactionnels — uniquement ton adresse courriel et le contenu strictement requis pour livrer le message ; <strong>Sentry</strong> (États-Unis) pour le monitoring d’erreurs techniques — voir <a href="#section-6">section 6</a> pour la liste exhaustive de ce qui y transite et ce qui en est exclu ; <strong>Stripe Payments Canada Ltd.</strong> (Toronto, Canada) pour le traitement des paiements — voir <a href="#section-11">section 11</a>. Le cas Stripe est matériellement différent : l’entité de traitement étant canadienne, il ne s’agit pas d’un transfert hors Canada.',
      },
      {
        h: '6. Monitoring d’erreurs (Sentry)',
        p: 'Quand une erreur technique survient dans le navigateur ou côté serveur, un rapport est envoyé à Sentry (Functional Software Inc., États-Unis) pour qu’elle me soit visible et que je la corrige rapidement. Ce qui est transmis : message d’erreur, trace de pile, navigateur/système, environnement (production / preview), <em>chemin</em> de l’URL où l’erreur s’est produite. Ce qui en est explicitement <strong>exclu</strong> : ton adresse courriel (sauf si tu es l’opérateur), les paramètres d’URL (jetons de lien magique, identifiants de session/partage), les témoins (cookies), les en-têtes d’authentification, l’adresse IP, les rejeux de session, les traces de performance. La rétention est fixée à 30 jours. Une évaluation des facteurs relatifs à la vie privée (EFVP) a été produite avant cette intégration et un accord de traitement (DPA) est en place avec Sentry — <a href="/pia#sentry">texte intégral de l’EFVP</a>. Pour t’exclure du monitoring d’erreurs te concernant, écris-moi.',
      },
      {
        h: '7. Tes droits : accès, rectification, portabilité',
        p: 'Tu as le droit de consulter et de corriger toutes les données que je détiens sur toi. Le portail t’en montre déjà la majeure partie : ta page <a href="/me">/me</a> liste tes sessions, tes intakes, nos échanges. Pour le reste — incluant un export portable au format JSON — écris-moi. Note : les événements d’erreur dans Sentry ne portent pas ton identité (voir section 6), donc ils ne peuvent pas t’être restitués individuellement ; en pratique cela signifie qu’il n’y a aucun renseignement personnel à ton sujet à exfiltrer depuis Sentry.',
      },
      {
        h: '8. Effacement',
        p: 'Tu peux supprimer ton compte et toutes tes données depuis ta page <a href="/me">/me</a> (bouton « Supprimer mes données ») ou en m’écrivant. La suppression est définitive : sessions, messages, pièces jointes, jetons d’authentification — tout part. Aucune copie ne survit dans une corbeille opérateur (les rangées soft-deleted sont aussi purgées). Côté Sentry, comme aucun événement n’est lié à ton identité, il n’y a rien à supprimer là-bas.',
      },
      {
        h: '9. Durée de conservation',
        p: 'Tant que ton compte existe, les données restent. Une session que tu retires du portail (corbeille) reste visible côté admin pour la durée de l’engagement, puis est purgée à la même date que ton compte. Les jetons de connexion par courriel expirent après 30 minutes et sont effacés à la première utilisation. Les événements d’erreur dans Sentry sont conservés 30 jours puis effacés automatiquement.',
      },
      {
        h: '10. Sécurité',
        p: 'TLS de bout en bout, témoin de session signé HMAC-SHA256, jetons de connexion hachés au repos (SHA-256), protection CSRF, en-têtes de sécurité stricts (CSP, HSTS). Si une fuite survient, je t’écris dans les 72 h, comme l’exige la Loi 25, à l’adresse courriel sur ton compte. Le journal d’audit interne (`/admin/audit`) trace toutes les actions admin.',
      },
      {
        h: '11. Paiements (Stripe Payments Canada Ltd.)',
        p: 'Quand tu paies un tier (1, 2 ou 3) ou que tu t’abonnes au mode dépositaire, le portail crée une session de paiement chez Stripe et te redirige vers leur page hébergée. <strong>Tes informations de carte ne transitent jamais par marc-portal</strong> — elles vont directement à Stripe. Ce que je transmets à Stripe : ton adresse courriel (pour le reçu), le montant, la devise (CAD), et le nom du projet sur la ligne de facturation. Ce qui en est exclu : ton nom, ton adresse postale, ton numéro de téléphone — Stripe ne reçoit rien de tout cela de ma part. Stripe Tax n’est pas activé. <strong>Pour les clients québécois, l’entité de traitement principale est Stripe Payments Canada Ltd. (Toronto)</strong> — le transfert direct depuis marc-portal aboutit donc chez une entité canadienne, ce qui réduit substantiellement (mais n’élimine pas complètement) l’exposition au sens de la Loi 25 art. 17 : Stripe effectue ensuite, à l’interne, des transferts vers ses affiliés américains pour l’infrastructure mondiale, encadrés par leur DPA. La rétention chez Stripe suit leur politique standard (7 ans pour les obligations CRA + FINTRAC, donc plus longue que la rétention sur marc-portal). Une EFVP propre à Stripe documente l’analyse complète — <a href="/pia#stripe">texte intégral de l’EFVP</a>. Tu peux gérer ton mode de paiement, voir tes reçus, et annuler ton abonnement via le portail client Stripe accessible depuis ta page <a href="/me">/me</a>. <strong>À noter : le reçu officiel arrive de Stripe (noreply@stripe.com), pas de marc-portal — c’est normal.</strong>',
      },
      {
        h: '12. Modifications',
        p: 'Toute modification matérielle de cette politique te sera notifiée par courriel à l’adresse de ton compte avant son entrée en vigueur. Les modifications mineures (clarifications, corrections grammaticales) sont datées en haut de la page sans notification individuelle.',
      },
    ],
  },
  en: {
    pageTitle: 'Privacy — Marc',
    title: 'Privacy policy',
    intro:
      'This page describes how this portal handles your personal information. It is short because the practice is small: one human (Marc), one database, transactional emails.',
    asOf: 'Effective: 2026-05-15. Last updated: 2026-05-15.',
    sections: [
      {
        h: '1. Responsible person',
        p: 'Marc is the personal-information protection officer for this portal (de facto DPO). For any question, access request, or complaint: <a href="mailto:marc@marcportal.com">marc@marcportal.com</a>. Reply within 30 days, as required by Quebec Bill 25.',
      },
      {
        h: '2. Information collected',
        p: 'The portal collects only what the service requires: your email address (for magic-link sign-in), your intake content (the problem you bring me), the messages we exchange in the session, and any attachments you upload. No behavioral analytics, no third-party cookies, no marketing pixels. A technical error-monitoring tool (Sentry) is used to diagnose bugs — details and minimization in <a href="#section-6">section 6</a>.',
      },
      {
        h: '3. Purposes',
        p: 'This data is used to (a) authenticate you without a password, (b) let you track your session, (c) let me triage and deliver the work. It is not resold, not used for outbound prospecting, not shared with third parties for marketing.',
      },
      {
        h: '4. Consent',
        p: 'By submitting the intake, you consent to the collection and processing described above. You may withdraw consent at any time by deleting your account (see section 8) or by writing to me — the session will be withdrawn from the portal within one business day.',
      },
      {
        h: '5. Hosting and data residency',
        p: 'Your session data (intake, messages, attachments, identity) lives in Cloudflare D1, region <code>enam</code> (Eastern North America, primary in Toronto). Cloudflare may replicate reads to other regions for latency, but writes and the canonical copy stay in Canada. Three third-party services receive a strictly limited subset: <strong>Resend</strong> (United States) for transactional emails — only your address and the content strictly required to deliver the message; <strong>Sentry</strong> (United States) for technical error monitoring — see <a href="#section-6">section 6</a> for the exhaustive list of what transits there and what is excluded; <strong>Stripe Payments Canada Ltd.</strong> (Toronto, Canada) for payment processing — see <a href="#section-11">section 11</a>. The Stripe case is materially different: the processing entity is Canadian, so it is not a transfer outside Canada.',
      },
      {
        h: '6. Error monitoring (Sentry)',
        p: 'When a technical error occurs in the browser or on the server side, a report is sent to Sentry (Functional Software Inc., United States) so it becomes visible to me and I can fix it quickly. What is transmitted: error message, stack trace, browser/OS, environment (production / preview), <em>path</em> of the URL where the error happened. What is explicitly <strong>excluded</strong>: your email address (unless you are the operator), URL parameters (magic-link tokens, session/share IDs), cookies, authentication headers, IP address, session replays, performance traces. Retention is set to 30 days. A privacy impact assessment (PIA) was produced before this integration and a data-processing agreement (DPA) is in place with Sentry — <a href="/en/pia#sentry">full PIA text</a>. To opt out of error monitoring concerning you, write to me.',
      },
      {
        h: '7. Your rights: access, rectification, portability',
        p: 'You have the right to view and correct all data I hold about you. The portal already shows most of it: your <a href="/en/me">/me</a> page lists your sessions, intakes, our messages. For the rest — including a portable JSON export — write to me. Note: Sentry error events do not carry your identity (see section 6), so they cannot be returned to you individually; in practice this means there is no personal information about you to exfiltrate from Sentry.',
      },
      {
        h: '8. Erasure',
        p: 'You can delete your account and all your data from your <a href="/en/me">/me</a> page ("Delete my data" button) or by writing to me. Deletion is permanent: sessions, messages, attachments, authentication tokens — everything goes. No copy survives in an operator trash (soft-deleted rows are also purged). On the Sentry side, since no event is linked to your identity, there is nothing to delete there.',
      },
      {
        h: '9. Retention period',
        p: 'As long as your account exists, the data stays. A session you withdraw from the portal (trash) remains visible on the admin side for the duration of the engagement, then is purged on the same date as your account. Email sign-in tokens expire after 30 minutes and are erased on first use. Error events in Sentry are retained for 30 days then automatically deleted.',
      },
      {
        h: '10. Security',
        p: 'End-to-end TLS, HMAC-SHA256-signed session cookies, sign-in tokens hashed at rest (SHA-256), CSRF protection, strict security headers (CSP, HSTS). If a breach occurs, I will write to you within 72 hours, as required by Bill 25, at the email on your account. The internal audit log (`/admin/audit`) traces every admin action.',
      },
      {
        h: '11. Payments (Stripe Payments Canada Ltd.)',
        p: 'When you pay a tier (1, 2, or 3) or subscribe to custodian mode, the portal creates a payment session with Stripe and redirects you to their hosted page. <strong>Your card details never transit through marc-portal</strong> — they go directly to Stripe. What I transmit to Stripe: your email address (for the receipt), the amount, the currency (CAD), and the project name on the line item. What is excluded: your name, mailing address, phone number — Stripe receives none of these from me. Stripe Tax is not enabled. <strong>For Quebec customers, the primary processing entity is Stripe Payments Canada Ltd. (Toronto)</strong> — so the direct transfer from marc-portal lands at a Canadian entity, which substantially reduces (but does not fully eliminate) Bill 25 art. 17 exposure: Stripe then performs intra-group transfers to US affiliates as part of operating its global infrastructure, governed by their DPA. Stripe retention follows their standard policy (7 years for CRA + FINTRAC obligations, longer than marc-portal retention by design). A Stripe-specific PIA documents the full analysis — <a href="/en/pia#stripe">full PIA text</a>. You can manage your payment method, see receipts, and cancel your subscription via the Stripe customer portal accessible from your <a href="/en/me">/me</a> page. <strong>Note: the official receipt comes from Stripe (noreply@stripe.com), not from marc-portal — that\'s normal.</strong>',
      },
      {
        h: '12. Changes',
        p: 'Any material change to this policy will be notified to you by email at your account address before it takes effect. Minor changes (clarifications, grammar fixes) are dated at the top of the page without individual notification.',
      },
    ],
  },
} as const

export function Privacy({ lang }: { lang: Lang }) {
  const t = COPY[lang]

  useEffect(() => {
    document.documentElement.lang = lang === 'fr' ? 'fr-CA' : 'en-CA'
    document.title = t.pageTitle
  }, [lang, t])

  return (
    <div className="app">
      <Header lang={lang} />
      <main id="main-content">
        <article className="section">
          <div className="section__inner privacy">
            <h1>{t.title}</h1>
            <p className="privacy__intro">{t.intro}</p>
            <p className="mono privacy__asof">{t.asOf}</p>
            {t.sections.map((s) => {
              // Derive an anchor id from the leading "N." in the heading, so
              // cross-references like "section 6" can link to it. Falls back
              // to undefined when the heading doesn't lead with a number.
              const m = /^(\d+)\./.exec(s.h)
              const id = m ? `section-${m[1]}` : undefined
              return (
                <section key={s.h} id={id} className="privacy__section">
                  <h2>{s.h}</h2>
                  {/* The body contains hand-curated <a>, <code>, <strong>, <em> tags only. */}
                  <p dangerouslySetInnerHTML={{ __html: s.p }} />
                </section>
              )
            })}
          </div>
        </article>
      </main>
      <Footer lang={lang} />
    </div>
  )
}
