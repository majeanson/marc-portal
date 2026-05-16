import { useEffect } from 'react'
import type { Lang } from '../i18n'
import { Header } from '../components/Header'
import { Footer } from '../components/Footer'

/**
 * Public operational checklist. The companion to /handoff — visitors who want
 * to verify the no-lock-in promise can read the exact transfer procedure
 * (assets, commands, accounts) without asking. The dormancy section doubles
 * as the kill-switch documentation that makes "Je m'en occupe" honest:
 * a client whose dev becomes unreachable can take ownership unilaterally.
 *
 * Source of truth for docs/handoff/CHECKLIST.md (kept in sync manually).
 */

const COPY = {
  fr: {
    pageTitle: 'Checklist de transfert — Marc',
    metaDescription:
      'Procédure exacte de transfert : repo, domaine, hébergement, base de données, courriels, secrets. Ce qui se passe à la livraison, étape par étape.',
    backHref: '/handoff',
    backLabel: '← Retour à « Comment ça finit »',
    eyebrow: 'transfert — procédure',
    title: 'Checklist de transfert',
    lead: "Ce qui se passe concrètement à la livraison. Conçu pour que tu puisses tout vérifier toi-même — et, en cas de besoin, pour qu'un autre dev puisse prendre la suite sans m'écrire.",
    asOf: 'En vigueur : 2026-05-15.',

    legend: {
      title: 'Légende',
      items: [
        { label: 'Mode « Tout à toi »', body: 'Étape exécutée au moment de la livraison.' },
        {
          label: 'Mode « Je m’en occupe »',
          body: 'Étape exécutée le jour où tu demandes le transfert (ou après 90 jours de dormance — voir section 8).',
        },
      ],
    },

    sections: [
      {
        h: '1. Confirmation préalable (J-7)',
        steps: [
          'Marc écrit un courriel récap : mode choisi, comptes cibles, date du transfert.',
          "Tu réponds avec : ton nom d'utilisateur GitHub, ton registrar préféré (OVH / Namecheap / autre), ton courriel Cloudflare (existant ou à créer).",
          "Marc te crée un dossier partagé 1Password (ou une note Bitwarden chiffrée) avec tous les identifiants — accès lecture seule jusqu'au jour J.",
        ],
      },
      {
        h: '2. Repo GitHub',
        steps: [
          'Marc lance `git tag v1.0-handoff` sur le dernier commit déployé et le pousse.',
          'Marc transfère la propriété du repo vers ton compte GitHub via Settings → Transfer ownership.',
          'Tu acceptes le transfert dans tes notifications GitHub (sous 24 h).',
          'Marc se retire de la liste des collaborateurs (Settings → Collaborators).',
          'Vérification : tu clones le repo (`git clone git@github.com:<toi>/<repo>.git`) — ça marche.',
        ],
      },
      {
        h: '3. Nom de domaine',
        steps: [
          'Cas A — domaine déjà à ton nom : aucun transfert nécessaire. Marc retire son accès admin chez le registrar.',
          "Cas B — domaine au nom de Marc : Marc déclenche le transfert chez le registrar, te fournit le code d'autorisation (auth-code), tu acceptes le transfert chez ton registrar choisi (5-7 jours).",
          'Pendant le transfert, le site reste en ligne — les DNS continuent de pointer.',
          'Une fois transféré, tu mets à jour ton WHOIS avec tes coordonnées.',
        ],
      },
      {
        h: '4. Hébergement (Cloudflare Pages)',
        steps: [
          'Option A — transfert direct : tu crées un compte Cloudflare (gratuit), Marc transfère le projet vers ton compte (Settings → Move).',
          'Option B — rebuild chez toi : Marc te fournit le `wrangler.toml`, les bindings (D1, R2) et la commande `npx wrangler pages deploy`. Tu rebâtis le déploiement à partir du repo.',
          "Les variables d'environnement (SESSION_SECRET, RESEND_API_KEY, etc.) sont régénérées (voir section 7) et entrées dans ton dashboard Cloudflare.",
          'Vérification : `curl https://<ton-domaine>/api/health` retourne `{ok:true}`.',
        ],
      },
      {
        h: '5. Base de données (Cloudflare D1)',
        steps: [
          'Marc lance `wrangler d1 export marc-portal-db --remote --output handoff.sql` pour produire un dump SQL complet.',
          "Le dump est chiffré avec ta clé publique GPG (ou un mot de passe symétrique partagé via 1Password) avant d'être envoyé.",
          'Tu crées une nouvelle D1 dans ton compte (`wrangler d1 create marc-portal-db`) et tu charges le dump (`wrangler d1 execute marc-portal-db --remote --file=handoff.sql`).',
          'Tu mets à jour le `database_id` dans `wrangler.toml`.',
          'Vérification : `wrangler d1 execute marc-portal-db --remote --command "SELECT COUNT(*) FROM users"` retourne le bon nombre.',
        ],
      },
      {
        h: '6. Service de courriels (Resend)',
        steps: [
          "Marc transfère l'ownership du compte Resend vers ton adresse (Settings → Team → Transfer).",
          'Tu vérifies que ton domaine est ajouté dans Resend et que les records SPF, DKIM, DMARC sont publiés dans ton DNS.',
          'Marc révoque ses anciens API keys.',
          "Tu génères un nouveau `RESEND_API_KEY` et tu l'entres dans tes variables d'environnement Cloudflare.",
          'Vérification : tu te connectes au portail, tu demandes un lien magique — le courriel arrive.',
        ],
      },
      {
        h: '7. Rotation des secrets',
        steps: [
          'Tous les secrets sont régénérés à la livraison, peu importe le mode :',
          '`SESSION_SECRET` — nouveau, ≥ 32 caractères aléatoires (cf. `openssl rand -hex 32`).',
          '`RESEND_API_KEY` — nouveau, généré par toi dans Resend.',
          '`DIGEST_TOKEN` (si utilisé) — nouveau, partagé via 1Password.',
          'Marc supprime sa copie locale et révoque tous ses accès admin Cloudflare, GitHub, Resend, registrar.',
          "Le journal d'audit (`/admin/audit`) montre la dernière entrée signée par Marc à la livraison — référence permanente.",
        ],
      },
      {
        h: '8. Procédure de dormance (kill-switch)',
        intro:
          "Si Marc devient injoignable pendant 90 jours consécutifs (aucune réponse à 3 courriels espacés d'au moins 30 jours, envoyés à marc.jeanson92@gmail.com), tu peux exécuter cette procédure unilatéralement pour prendre la pleine propriété :",
        steps: [
          'Étape 1 — Pris-acte : envoyer un dernier courriel marqué « DORMANCE 90 jours — prise unilatérale de propriété en cours » à marc.jeanson92@gmail.com avec en copie un témoin (avocat, comptable, ami technique).',
          'Étape 2 — Reset GitHub : ouvrir un ticket GitHub Support avec preuve du contrat initial + journal des courriels sans réponse. GitHub transfère la propriété sous 30 jours.',
          'Étape 3 — Reset Cloudflare : ouvrir un ticket Cloudflare Support — même procédure, même délai.',
          "Étape 4 — Reset domaine : contacter le registrar avec les mêmes pièces. Si le registrar est Cloudflare, le transfert se fait avec l'étape 3.",
          'Étape 5 — Reset Resend : peut être abandonné et reconstruit chez toi avec un nouveau compte Resend.',
          'Étape 6 — Régénérer tous les secrets (voir section 7) et redéployer.',
          "Cette procédure est versée dans tes documents au moment de la livraison sous forme imprimable. Tu n'as rien à demander à Marc pour l'exécuter — c'est le sens du mot « kill-switch ».",
        ],
      },
      {
        h: '9. Acceptation et garantie',
        steps: [
          "Tu signes (papier ou DocuSign) une attestation d'acceptation : tu confirmes avoir reçu et vérifié les transferts ci-dessus.",
          'Le tag git `v1.0-handoff-accepted-AAAA-MM-JJ` est posé à ce moment.',
          'Garantie de 90 jours : Marc règle gratuitement tout bug introduit par son code, à condition que tu lui en parles dans la fenêtre.',
          'Au-delà des 90 jours, toute intervention est au tarif horaire Tier 2, et seulement à ta demande explicite.',
        ],
      },
    ],

    cta: {
      title: 'Tu as une question avant de commencer?',
      body: 'Pas besoin de tout absorber maintenant. Cette page existe pour que tu puisses revenir la consulter à n’importe quel moment — pendant un projet, avant de signer, ou après la livraison.',
      back: '← Retour à « Comment ça finit »',
      intake: 'Ouvrir le formulaire →',
    },
  },
  en: {
    pageTitle: 'Handoff checklist — Marc',
    metaDescription:
      'Exact transfer procedure: repo, domain, hosting, database, email, secrets. What happens at delivery, step by step.',
    backHref: '/en/handoff',
    backLabel: '← Back to "How it ends"',
    eyebrow: 'transfer — procedure',
    title: 'Handoff checklist',
    lead: 'What concretely happens at delivery. Designed so you can verify everything yourself — and, if needed, so another dev can pick up where I left off without contacting me.',
    asOf: 'Effective: 2026-05-15.',

    legend: {
      title: 'Legend',
      items: [
        { label: 'Mode "All yours"', body: 'Step executed at delivery.' },
        {
          label: 'Mode "I handle it"',
          body: 'Step executed the day you request the transfer (or after 90 days of dormancy — see section 8).',
        },
      ],
    },

    sections: [
      {
        h: '1. Pre-confirmation (D-7)',
        steps: [
          'Marc sends a recap email: chosen mode, target accounts, transfer date.',
          'You reply with: your GitHub username, your preferred registrar (OVH / Namecheap / other), your Cloudflare email (existing or to be created).',
          'Marc creates a shared 1Password vault (or encrypted Bitwarden note) with every credential — read-only access until D-day.',
        ],
      },
      {
        h: '2. GitHub repo',
        steps: [
          'Marc runs `git tag v1.0-handoff` on the last deployed commit and pushes it.',
          'Marc transfers repo ownership to your GitHub account via Settings → Transfer ownership.',
          'You accept the transfer in your GitHub notifications (within 24h).',
          'Marc removes himself from the collaborators list (Settings → Collaborators).',
          'Verification: you clone the repo (`git clone git@github.com:<you>/<repo>.git`) — it works.',
        ],
      },
      {
        h: '3. Domain name',
        steps: [
          'Case A — domain already in your name: no transfer needed. Marc removes his admin access at the registrar.',
          "Case B — domain in Marc's name: Marc initiates the transfer at his registrar, gives you the auth-code, you accept the transfer at your chosen registrar (5-7 days).",
          'During the transfer, the site stays online — DNS continues to point.',
          'Once transferred, you update your WHOIS with your contact details.',
        ],
      },
      {
        h: '4. Hosting (Cloudflare Pages)',
        steps: [
          'Option A — direct transfer: you create a Cloudflare account (free), Marc moves the project to your account (Settings → Move).',
          'Option B — rebuild in yours: Marc gives you `wrangler.toml`, bindings (D1, R2) and the `npx wrangler pages deploy` command. You rebuild from the repo.',
          'Environment variables (SESSION_SECRET, RESEND_API_KEY, etc.) are regenerated (see section 7) and entered into your Cloudflare dashboard.',
          'Verification: `curl https://<your-domain>/api/health` returns `{ok:true}`.',
        ],
      },
      {
        h: '5. Database (Cloudflare D1)',
        steps: [
          'Marc runs `wrangler d1 export marc-portal-db --remote --output handoff.sql` for a full SQL dump.',
          'The dump is encrypted with your GPG public key (or a symmetric password shared via 1Password) before being sent.',
          'You create a new D1 in your account (`wrangler d1 create marc-portal-db`) and load the dump (`wrangler d1 execute marc-portal-db --remote --file=handoff.sql`).',
          'You update the `database_id` in `wrangler.toml`.',
          'Verification: `wrangler d1 execute marc-portal-db --remote --command "SELECT COUNT(*) FROM users"` returns the right number.',
        ],
      },
      {
        h: '6. Email service (Resend)',
        steps: [
          'Marc transfers Resend account ownership to your address (Settings → Team → Transfer).',
          'You verify your domain is added in Resend and that SPF, DKIM, DMARC records are published in your DNS.',
          'Marc revokes his old API keys.',
          'You generate a new `RESEND_API_KEY` and enter it in your Cloudflare environment variables.',
          'Verification: you sign into the portal, request a magic link — the email arrives.',
        ],
      },
      {
        h: '7. Secret rotation',
        steps: [
          'All secrets are regenerated at handoff, regardless of mode:',
          '`SESSION_SECRET` — new, ≥ 32 random characters (e.g. `openssl rand -hex 32`).',
          '`RESEND_API_KEY` — new, generated by you in Resend.',
          '`DIGEST_TOKEN` (if used) — new, shared via 1Password.',
          'Marc deletes his local copy and revokes all his admin access on Cloudflare, GitHub, Resend, registrar.',
          'The audit log (`/admin/audit`) shows the last entry signed by Marc at delivery — a permanent reference point.',
        ],
      },
      {
        h: '8. Dormancy procedure (kill-switch)',
        intro:
          'If Marc becomes unreachable for 90 consecutive days (no reply to 3 emails spaced at least 30 days apart, sent to marc.jeanson92@gmail.com), you can execute this procedure unilaterally to take full ownership:',
        steps: [
          'Step 1 — Acknowledgment: send a final email titled "DORMANCY 90 days — unilateral ownership claim in progress" to marc.jeanson92@gmail.com with a witness (lawyer, accountant, technical friend) in CC.',
          'Step 2 — GitHub reset: open a GitHub Support ticket with proof of the original contract + log of unanswered emails. GitHub transfers ownership within 30 days.',
          'Step 3 — Cloudflare reset: open a Cloudflare Support ticket — same procedure, same timeline.',
          'Step 4 — Domain reset: contact the registrar with the same evidence. If the registrar is Cloudflare, the transfer happens with step 3.',
          'Step 5 — Resend reset: can be abandoned and rebuilt on your side with a new Resend account.',
          'Step 6 — Regenerate all secrets (see section 7) and redeploy.',
          "This procedure is handed to you at delivery in printed form. You don't need to ask Marc anything to execute it — that's what 'kill-switch' means.",
        ],
      },
      {
        h: '9. Acceptance and warranty',
        steps: [
          'You sign (paper or DocuSign) an acceptance attestation: you confirm having received and verified the transfers above.',
          'The git tag `v1.0-handoff-accepted-YYYY-MM-DD` is placed at that moment.',
          '90-day warranty: Marc fixes any bug introduced by his code, free, provided you tell him within the window.',
          'Beyond 90 days, any intervention is at the Tier 2 hourly rate, and only at your explicit request.',
        ],
      },
    ],

    cta: {
      title: 'Got a question before we start?',
      body: 'No need to absorb this all now. This page exists so you can come back to it anytime — during a project, before signing, or after delivery.',
      back: '← Back to "How it ends"',
      intake: 'Open the form →',
    },
  },
} as const

export function HandoffChecklist({ lang }: { lang: Lang }) {
  const t = COPY[lang]
  const langPrefix = lang === 'fr' ? '' : '/en'

  useEffect(() => {
    document.documentElement.lang = lang === 'fr' ? 'fr-CA' : 'en-CA'
    document.title = t.pageTitle
    const meta = document.querySelector('meta[name="description"]')
    if (meta) meta.setAttribute('content', t.metaDescription)
  }, [lang, t])

  return (
    <div className="app">
      <Header lang={lang} />
      <main id="main-content">
        <article className="section">
          <div className="section__inner privacy handoff handoff--checklist">
            <a className="showcase-page__back" href={t.backHref}>
              {t.backLabel}
            </a>

            <header className="handoff__hero">
              <div className="section__eyebrow">{t.eyebrow}</div>
              <h1>{t.title}</h1>
              <p className="privacy__intro">{t.lead}</p>
              <p className="mono privacy__asof">{t.asOf}</p>
            </header>

            <section className="handoff-legend">
              <h2>{t.legend.title}</h2>
              <ul>
                {t.legend.items.map((it) => (
                  <li key={it.label}>
                    <strong>{it.label}</strong> — {it.body}
                  </li>
                ))}
              </ul>
            </section>

            {t.sections.map((s) => {
              const m = /^(\d+)\./.exec(s.h)
              const id = m ? `checklist-section-${m[1]}` : undefined
              return (
                <section
                  key={s.h}
                  id={id}
                  className="privacy__section handoff__section handoff-checklist__section"
                >
                  <h2>{s.h}</h2>
                  {'intro' in s && s.intro ? <p>{s.intro}</p> : null}
                  <ol className="handoff-checklist__steps">
                    {s.steps.map((step, idx) => (
                      <li key={idx}>{step}</li>
                    ))}
                  </ol>
                </section>
              )
            })}

            <section className="handoff__cta">
              <h2>{t.cta.title}</h2>
              <p>{t.cta.body}</p>
              <div className="handoff__cta-actions">
                <a href={t.backHref} className="link-btn mono">
                  {t.cta.back}
                </a>
                <a href={`${langPrefix}/intake`} className="hero__cta">
                  {t.cta.intake}
                </a>
              </div>
            </section>
          </div>
        </article>
      </main>
      <Footer lang={lang} />
    </div>
  )
}
