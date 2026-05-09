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
    asOf: 'En vigueur : 2026-05-09. Dernière mise à jour : 2026-05-09.',
    sections: [
      {
        h: '1. Responsable',
        p: 'Marc Jeanson est le responsable de la protection des renseignements personnels de ce portail (DPO de fait). Pour toute question, demande d’accès ou plainte : <a href="mailto:marc.jeanson92@gmail.com">marc.jeanson92@gmail.com</a>. Réponse en moins de 30 jours, comme l’exige la Loi 25.',
      },
      {
        h: '2. Renseignements collectés',
        p: 'Le portail collecte uniquement le strict nécessaire à la prestation du service : ton adresse courriel (pour la connexion par lien magique), le contenu de ton intake (le problème que tu m’apportes), nos messages échangés dans la session, et toute pièce jointe que tu déposes. Aucune donnée comportementale, aucun cookie tiers, aucun pixel d’analytique.',
      },
      {
        h: '3. Finalités',
        p: 'Ces données servent à : (a) t’authentifier sans mot de passe, (b) te permettre de suivre ta session, (c) que je puisse triager et livrer le travail. Elles ne sont ni revendues, ni utilisées pour de la prospection, ni partagées avec des tiers à des fins de marketing.',
      },
      {
        h: '4. Consentement',
        p: 'En soumettant l’intake, tu consens à la collecte et au traitement décrits ci-dessus. Tu peux retirer ton consentement en tout temps en supprimant ton compte (voir section 7) ou en m’écrivant — la session sera retirée du portail dans la même journée ouvrable.',
      },
      {
        h: '5. Hébergement et résidence des données',
        p: 'Les données vivent dans Cloudflare D1, région <code>enam</code> (Eastern North America, primaire à Toronto). Cloudflare peut répliquer en lecture vers d’autres régions pour la latence, mais l’écriture et la copie de référence restent au Canada. Resend est utilisé pour les courriels transactionnels (États-Unis) — seuls le destinataire et le contenu strictement nécessaire à la livraison du courriel y transitent.',
      },
      {
        h: '6. Tes droits : accès, rectification, portabilité',
        p: 'Tu as le droit de consulter et de corriger toutes les données que je détiens sur toi. Le portail t’en montre déjà la majeure partie : ta page <a href="/me">/me</a> liste tes sessions, tes intakes, nos échanges. Pour le reste — incluant un export portable au format JSON — écris-moi.',
      },
      {
        h: '7. Effacement',
        p: 'Tu peux supprimer ton compte et toutes tes données depuis ta page <a href="/me">/me</a> (bouton « Supprimer mes données ») ou en m’écrivant. La suppression est définitive : sessions, messages, pièces jointes, jetons d’authentification — tout part. Aucune copie ne survit dans une corbeille opérateur (les rangées soft-deleted sont aussi purgées).',
      },
      {
        h: '8. Durée de conservation',
        p: 'Tant que ton compte existe, les données restent. Une session que tu retires du portail (corbeille) reste visible côté admin pour la durée de l’engagement, puis est purgée à la même date que ton compte. Les jetons de connexion par courriel expirent après 30 minutes et sont effacés à la première utilisation.',
      },
      {
        h: '9. Sécurité',
        p: 'TLS de bout en bout, témoin de session signé HMAC-SHA256, jetons de connexion hachés au repos (SHA-256), aucun secret en clair. Si une fuite survient, je t’écris dans les 72 h, comme l’exige la Loi 25, à l’adresse courriel sur ton compte. Le journal d’audit interne (`/admin/audit`) trace toutes les actions admin.',
      },
      {
        h: '10. Modifications',
        p: 'Toute modification matérielle de cette politique te sera notifiée par courriel à l’adresse de ton compte avant son entrée en vigueur. Les modifications mineures (clarifications, corrections grammaticales) sont datées en haut de la page sans notification individuelle.',
      },
    ],
  },
  en: {
    pageTitle: 'Privacy — Marc',
    title: 'Privacy policy',
    intro:
      'This page describes how this portal handles your personal information. It is short because the practice is small: one human (Marc), one database, transactional emails.',
    asOf: 'Effective: 2026-05-09. Last updated: 2026-05-09.',
    sections: [
      {
        h: '1. Responsible person',
        p: 'Marc Jeanson is the personal-information protection officer for this portal (de facto DPO). For any question, access request, or complaint: <a href="mailto:marc.jeanson92@gmail.com">marc.jeanson92@gmail.com</a>. Reply within 30 days, as required by Quebec Bill 25.',
      },
      {
        h: '2. Information collected',
        p: 'The portal collects only what the service requires: your email address (for magic-link sign-in), your intake content (the problem you bring me), the messages we exchange in the session, and any attachments you upload. No behavioral data, no third-party cookies, no analytics pixels.',
      },
      {
        h: '3. Purposes',
        p: 'This data is used to (a) authenticate you without a password, (b) let you track your session, (c) let me triage and deliver the work. It is not resold, not used for outbound prospecting, not shared with third parties for marketing.',
      },
      {
        h: '4. Consent',
        p: 'By submitting the intake, you consent to the collection and processing described above. You may withdraw consent at any time by deleting your account (see section 7) or by writing to me — the session will be withdrawn from the portal within one business day.',
      },
      {
        h: '5. Hosting and data residency',
        p: 'Data lives in Cloudflare D1, region <code>enam</code> (Eastern North America, primary in Toronto). Cloudflare may replicate reads to other regions for latency, but writes and the canonical copy stay in Canada. Resend is used for transactional emails (United States) — only the recipient address and the content strictly required to deliver the email transit there.',
      },
      {
        h: '6. Your rights: access, rectification, portability',
        p: 'You have the right to view and correct all data I hold about you. The portal already shows most of it: your <a href="/en/me">/me</a> page lists your sessions, intakes, our messages. For the rest — including a portable JSON export — write to me.',
      },
      {
        h: '7. Erasure',
        p: 'You can delete your account and all your data from your <a href="/en/me">/me</a> page ("Delete my data" button) or by writing to me. Deletion is permanent: sessions, messages, attachments, authentication tokens — everything goes. No copy survives in an operator trash (soft-deleted rows are also purged).',
      },
      {
        h: '8. Retention period',
        p: 'As long as your account exists, the data stays. A session you withdraw from the portal (trash) remains visible on the admin side for the duration of the engagement, then is purged on the same date as your account. Email sign-in tokens expire after 30 minutes and are erased on first use.',
      },
      {
        h: '9. Security',
        p: 'End-to-end TLS, HMAC-SHA256-signed session cookies, sign-in tokens hashed at rest (SHA-256), no plaintext secrets. If a breach occurs, I will write to you within 72 hours, as required by Bill 25, at the email on your account. The internal audit log (`/admin/audit`) traces every admin action.',
      },
      {
        h: '10. Changes',
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
            {t.sections.map((s) => (
              <section key={s.h} className="privacy__section">
                <h2>{s.h}</h2>
                {/* The body contains hand-curated <a> and <code> tags only. */}
                <p dangerouslySetInnerHTML={{ __html: s.p }} />
              </section>
            ))}
          </div>
        </article>
      </main>
      <Footer lang={lang} />
    </div>
  )
}
