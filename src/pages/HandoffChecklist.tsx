import { useEffect } from 'react'
import type { Lang } from '../i18n'
import { Header } from '../components/Header'
import { Footer } from '../components/Footer'
import { FeatureFolioLink } from '../components/FeatureFolioLink'
import { PAGE_FOLIOS } from '../lib/folios'
import { PAGE_FEATURE } from '../lib/features'

/**
 * Public operational checklist. Companion to /handoff.
 *
 * Structure is deliberately layered for two audiences:
 *   1. The buyer (a Quebec roofer / notary / accountant) reads sections 1–4
 *      in plain language and never sees a command.
 *   2. The next dev (if the client ever migrates) opens the collapsed
 *      "Détails techniques" section at the bottom for asset-by-asset
 *      commands and account-level instructions.
 *
 * The procedure itself was simplified from an earlier 9-section version:
 *   - GPG-encrypted D1 dumps are now opt-in (default share is 1Password file).
 *   - Two git tags collapsed to one (`v1.0-handoff`); the email recap is the
 *     acceptance record.
 *   - Dormancy threshold dropped from 90 days × 3 emails to 30 days × 1
 *     unanswered email — less legalistic, still operationally honest.
 *
 * Source of truth for docs/handoff/CHECKLIST.md (kept in sync manually).
 */

const COPY = {
  fr: {
    pageTitle: 'Checklist de transfert — Marc',
    metaDescription:
      'Ce qui se passe à la livraison, en 5 étapes simples. Détails techniques pour ton prochain dev en bas de page.',
    backHref: '/handoff',
    backLabel: '← Retour à « Comment ça finit »',
    eyebrow: 'transfert — procédure',
    title: 'Checklist de transfert',
    lead: "Ce qui se passe concrètement quand je livre. La version courte tient en 5 étapes. Les détails techniques (commandes, comptes, étapes pour ton prochain dev) sont en bas, repliés — tu n'as pas besoin de les lire pour te sentir en sécurité.",
    asOf: 'En vigueur : 2026-05-15.',

    quickSummary: {
      title: 'Le résumé en 5 étapes',
      sub: "C'est tout ce qu'un client typique a besoin de savoir. Aucun jargon, aucune commande.",
      steps: [
        {
          h: 'Tu reçois tous les identifiants',
          p: "Dans une note partagée 1Password : repo GitHub, domaine, compte Cloudflare, service de courriels. Tout sous ton nom (ou prêt à passer à ton nom si tu es en mode « Je m'en occupe »).",
        },
        {
          h: 'Marc tague le commit final',
          p: "Le dernier commit reçoit le tag git `v1.0-handoff`. C'est ton repère permanent dans l'historique du repo — pour toi ou pour le prochain dev.",
        },
        {
          h: 'Marc retire son accès partout',
          p: "GitHub, Cloudflare, Resend, registrar du domaine — Marc se retire de chaque service. Il n'a plus les clés, même s'il voulait. Les secrets sensibles (clés API, jetons de session) sont régénérés au même moment.",
        },
        {
          h: 'Tu reçois un courriel récap',
          p: "Une seule adresse, tous les liens et identifiants regroupés. C'est ta documentation officielle — garde-la, imprime-la, partage-la avec un proche.",
        },
        {
          h: 'Garantie de 90 jours',
          p: "Pendant 90 jours après le courriel récap, tout bug introduit par mon code, je le règle gratuitement. Au-delà, c'est au tarif horaire et seulement si tu en redemandes.",
        },
      ],
    },

    managed: {
      title: "Et si tu as choisi « Je m'en occupe » ?",
      body: "Les 5 étapes ci-dessus restent vraies, mais elles arrivent le jour où tu demandes le transfert (et pas à la livraison initiale). Entre-temps, Marc garde les comptes en dépositaire et s'occupe des renouvellements de domaine, des mises à jour de sécurité, des certificats TLS. Tu peux demander le transfert n'importe quand — il s'exécute en environ une semaine, sans frais, sans question. C'est le sens de « dépositaire » : Marc tient les clés mais elles t'appartiennent.",
    },

    dormancy: {
      title: 'Si Marc devient injoignable',
      lead: "C'est la situation à laquelle « Je m'en occupe » doit résister. Si tu m'écris et tu n'as pas de réponse dans les 30 jours, voici comment tu reprends la pleine propriété toi-même — sans avoir à me demander.",
      threshold:
        "<strong>Seuil : 30 jours sans réponse.</strong> Un courriel envoyé à marc.jeanson92@gmail.com et resté sans réponse pendant 30 jours déclenche la procédure. Garde le courriel et son horodatage — c'est ta preuve.",
      steps: [
        {
          h: 'Ouvre un ticket GitHub Support',
          p: 'Fournis ton courriel resté sans réponse + une copie du contrat ou de la facture initiale. GitHub transfère la propriété du repo sous environ 30 jours.',
        },
        {
          h: 'Ouvre un ticket Cloudflare Support',
          p: "Même procédure. Le compte Cloudflare (hébergement + domaine s'il est chez Cloudflare Registrar) te revient.",
        },
        {
          h: 'Contacte le registrar du domaine si différent',
          p: "Si ton domaine n'est pas chez Cloudflare Registrar, contacte le registrar concerné (OVH, Namecheap, etc.) avec les mêmes pièces.",
        },
        {
          h: 'Régénère les secrets et redéploie',
          p: 'Une fois propriétaire, change `SESSION_SECRET` et `RESEND_API_KEY` (les détails sont dans la section technique en bas). Tu repars avec des clés que Marc ne connaît plus.',
        },
      ],
      ending:
        "Cette page reste accessible publiquement à <code>/handoff/checklist</code>. Tu peux l'imprimer et la garder avec tes autres documents importants — pas besoin de te souvenir de l'URL.",
    },

    technical: {
      title: 'Détails techniques (pour ton prochain dev)',
      lead: "Si un jour tu fais reprendre le projet par un autre dev, voici la procédure asset par asset, avec les commandes. Tu n'as pas besoin de lire cette section comme client — elle est là pour la personne technique qui te succédera.",
      sections: [
        {
          h: 'Repo GitHub',
          steps: [
            '`git tag v1.0-handoff` sur le dernier commit déployé, push du tag.',
            'Mode « Tout à toi » : transfert de propriété via GitHub Settings → Transfer ownership vers le compte du client. Client accepte sous 24 h.',
            "Mode « Je m'en occupe » : Marc reste propriétaire, le client est invité comme collaborateur en lecture.",
            'À la livraison effective : Marc retire son accès collaborateur via Settings → Collaborators.',
          ],
        },
        {
          h: 'Domaine',
          steps: [
            'Par défaut : le domaine est enregistré chez Cloudflare Registrar au nom du client dès le début du projet. Aucun transfert nécessaire à la livraison — Marc retire seulement son accès admin.',
            "Cas alternatif (domaine au nom de Marc) : Marc déclenche le transfert chez son registrar, fournit le code d'autorisation (auth-code) au client, qui accepte chez son registrar choisi. Délai 5-7 jours. Le site reste en ligne.",
          ],
        },
        {
          h: 'Hébergement Cloudflare Pages',
          steps: [
            'Mode « Tout à toi » : le projet est créé dans le compte Cloudflare du client dès le départ ; Marc est invité au compte. À la livraison, Marc se retire (Account Home → Members).',
            "Mode « Je m'en occupe » → transfert ultérieur : option A — déplacer le projet vers le compte du client (Settings → Move). Option B — rebuilder à partir du repo avec `npx wrangler pages deploy`, plus simple si peu de configuration custom.",
            "Variables d'environnement (SESSION_SECRET, RESEND_API_KEY) : régénérées au moment du transfert (voir Rotation des secrets ci-dessous) et entrées dans le dashboard du client.",
            'Vérification : `curl https://<domaine>/api/health` retourne `{ok:true}`.',
          ],
        },
        {
          h: 'Base de données Cloudflare D1',
          steps: [
            'Export : `wrangler d1 export marc-portal-db --remote --output handoff.sql`.',
            'Partage par défaut : fichier joint à une note 1Password partagée avec le client (chiffré en transit + au repos par 1Password). Suffisant pour la grande majorité des projets.',
            "Si le projet contient des renseignements personnels sensibles, le dump peut être chiffré GPG avant partage — c'est une option, pas une obligation. À discuter au cas par cas.",
            'Import côté client : `wrangler d1 create marc-portal-db`, puis `wrangler d1 execute marc-portal-db --remote --file=handoff.sql`. Mettre à jour `database_id` dans `wrangler.toml`.',
          ],
        },
        {
          h: 'Service de courriels Resend',
          steps: [
            "Pas tous les projets utilisent Resend — cette section ne s'applique que si le projet envoie des courriels transactionnels.",
            "Transfert : Settings → Team → Transfer ownership vers l'adresse du client.",
            'Le client vérifie son domaine dans Resend (records SPF, DKIM, DMARC dans le DNS).',
            'Marc révoque ses anciens API keys ; le client génère un nouveau `RESEND_API_KEY` et le met dans Cloudflare.',
          ],
        },
        {
          h: 'Rotation des secrets',
          steps: [
            'Tous les secrets sont régénérés à la livraison (ou au transfert si en mode dépositaire) :',
            '`SESSION_SECRET` — nouveau, ≥ 32 caractères : `openssl rand -hex 32`.',
            '`RESEND_API_KEY` — généré par le client dans Resend après transfert.',
            "Marc supprime sa copie locale de tous les secrets et révoque ses jetons d'accès admin sur chaque service.",
          ],
        },
      ],
    },

    cta: {
      title: 'Une question?',
      body: "Tu peux revenir consulter cette page à n'importe quel moment — pendant un projet, avant de signer, ou après la livraison. C'est aussi imprimable.",
      back: '← Retour à « Comment ça finit »',
      intake: 'Ouvrir le formulaire →',
    },
  },
  en: {
    pageTitle: 'Handoff checklist — Marc',
    metaDescription:
      'What happens at delivery, in 5 plain steps. Technical detail for your next dev at the bottom.',
    backHref: '/en/handoff',
    backLabel: '← Back to "How it ends"',
    eyebrow: 'transfer — procedure',
    title: 'Handoff checklist',
    lead: "What concretely happens when I deliver. The short version fits in 5 steps. The technical detail (commands, accounts, steps for your next dev) is at the bottom, collapsed — you don't need to read it to feel safe.",
    asOf: 'Effective: 2026-05-15.',

    quickSummary: {
      title: 'The 5-step recap',
      sub: 'This is everything a typical client needs to know. No jargon, no commands.',
      steps: [
        {
          h: 'You receive every credential',
          p: 'In a shared 1Password note: GitHub repo, domain, Cloudflare account, email service. All in your name (or ready to switch to your name if you picked "I handle it").',
        },
        {
          h: 'Marc tags the final commit',
          p: "The last commit gets the git tag `v1.0-handoff`. That's your permanent marker in the repo's history — for you or for the next dev.",
        },
        {
          h: 'Marc removes his access everywhere',
          p: 'GitHub, Cloudflare, Resend, domain registrar — Marc steps off every service. He no longer has the keys, even if he wanted them. Sensitive secrets (API keys, session tokens) are regenerated at the same time.',
        },
        {
          h: 'You get a recap email',
          p: "One email, every link and credential in one place. That's your official documentation — keep it, print it, share a copy with someone you trust.",
        },
        {
          h: '90-day warranty',
          p: 'For 90 days after the recap email, any bug introduced by my code, I fix free. Beyond that, hourly rate and only if you ask.',
        },
      ],
    },

    managed: {
      title: "And if you chose 'I handle it'?",
      body: "The 5 steps above still apply, but they happen the day you ask for the transfer (not at the initial delivery). In the meantime, Marc holds the accounts as custodian and handles domain renewals, security updates, TLS certificates. You can ask for the transfer at any moment — it runs in about a week, no fee, no questions. That's what 'custodian' means: Marc holds the keys but they're yours.",
    },

    dormancy: {
      title: 'If Marc becomes unreachable',
      lead: "This is what 'I handle it' must survive. If you write to me and don't hear back in 30 days, here's how you take full ownership yourself — without needing to ask me anything.",
      threshold:
        "<strong>Threshold: 30 days without a reply.</strong> An email sent to marc.jeanson92@gmail.com that stays unanswered for 30 days triggers the procedure. Keep the email and its timestamp — that's your evidence.",
      steps: [
        {
          h: 'Open a GitHub Support ticket',
          p: 'Provide your unanswered email + a copy of the original contract or invoice. GitHub transfers repo ownership within about 30 days.',
        },
        {
          h: 'Open a Cloudflare Support ticket',
          p: 'Same procedure. The Cloudflare account (hosting + domain if at Cloudflare Registrar) comes back to you.',
        },
        {
          h: 'Contact the domain registrar if separate',
          p: "If your domain isn't at Cloudflare Registrar, contact the relevant registrar (OVH, Namecheap, etc.) with the same evidence.",
        },
        {
          h: 'Regenerate secrets and redeploy',
          p: "Once you're the owner, rotate `SESSION_SECRET` and `RESEND_API_KEY` (details in the technical section below). You restart with keys Marc no longer knows.",
        },
      ],
      ending:
        'This page stays publicly available at <code>/en/handoff/checklist</code>. You can print it and keep it with your other important documents — no need to remember the URL.',
    },

    technical: {
      title: 'Technical detail (for your next dev)',
      lead: "If someday you have another dev pick up the project, here's the asset-by-asset procedure with commands. You don't need to read this section as a client — it's here for the technical person who succeeds you.",
      sections: [
        {
          h: 'GitHub repo',
          steps: [
            '`git tag v1.0-handoff` on the last deployed commit, push the tag.',
            "Mode 'All yours': ownership transfer via GitHub Settings → Transfer ownership to the client's account. Client accepts within 24h.",
            "Mode 'I handle it': Marc remains the owner, the client is invited as a read collaborator.",
            'At effective delivery: Marc removes his collaborator access via Settings → Collaborators.',
          ],
        },
        {
          h: 'Domain',
          steps: [
            "Default: the domain is registered at Cloudflare Registrar in the client's name from the start. No transfer needed at delivery — Marc just removes his admin access.",
            "Alternative case (domain in Marc's name): Marc initiates the transfer at his registrar, gives the auth-code to the client, who accepts at their chosen registrar. 5-7 days. The site stays online.",
          ],
        },
        {
          h: 'Cloudflare Pages hosting',
          steps: [
            "Mode 'All yours': the project is created in the client's Cloudflare account from the start; Marc is invited to the account. At delivery, Marc removes himself (Account Home → Members).",
            "Mode 'I handle it' → later transfer: option A — move the project to the client's account (Settings → Move). Option B — rebuild from the repo with `npx wrangler pages deploy`, simpler if there's little custom config.",
            "Environment variables (SESSION_SECRET, RESEND_API_KEY): regenerated at transfer time (see Secret rotation below) and entered in the client's dashboard.",
            'Verification: `curl https://<domain>/api/health` returns `{ok:true}`.',
          ],
        },
        {
          h: 'Cloudflare D1 database',
          steps: [
            'Export: `wrangler d1 export marc-portal-db --remote --output handoff.sql`.',
            'Default share: file attached to a 1Password shared note (encrypted in transit + at rest by 1Password). Sufficient for the vast majority of projects.',
            "If the project carries sensitive personal data, the dump can be GPG-encrypted before sharing — it's an option, not a requirement. Discussed case by case.",
            'Client-side import: `wrangler d1 create marc-portal-db`, then `wrangler d1 execute marc-portal-db --remote --file=handoff.sql`. Update `database_id` in `wrangler.toml`.',
          ],
        },
        {
          h: 'Resend email service',
          steps: [
            'Not every project uses Resend — this section only applies if the project sends transactional emails.',
            "Transfer: Settings → Team → Transfer ownership to the client's address.",
            'Client verifies their domain in Resend (SPF, DKIM, DMARC records in DNS).',
            'Marc revokes his old API keys; the client generates a new `RESEND_API_KEY` and adds it to Cloudflare.',
          ],
        },
        {
          h: 'Secret rotation',
          steps: [
            'All secrets are regenerated at delivery (or at transfer for managed mode):',
            '`SESSION_SECRET` — new, ≥ 32 characters: `openssl rand -hex 32`.',
            '`RESEND_API_KEY` — generated by the client in Resend after transfer.',
            'Marc deletes his local copy of every secret and revokes his admin access tokens on each service.',
          ],
        },
      ],
    },

    cta: {
      title: 'A question?',
      body: "You can come back to this page anytime — during a project, before signing, or after delivery. It's also printable.",
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
    <div className="app" data-feature={PAGE_FEATURE['page.handoff-checklist']}>
      <Header lang={lang} />
      <main id="main-content">
        <article className="section">
          <div className="section__inner privacy handoff handoff--checklist">
            <a className="showcase-page__back" href={t.backHref}>
              {t.backLabel}
            </a>

            <header className="handoff__hero">
              <div className="section__eyebrow">{t.eyebrow}</div>
              <FeatureFolioLink feature={PAGE_FEATURE['page.handoff-checklist']} lang={lang}>
                № {PAGE_FOLIOS.handoffChecklist}
              </FeatureFolioLink>
              <h1>{t.title}</h1>
              <p className="privacy__intro">{t.lead}</p>
              <p className="mono privacy__asof">{t.asOf}</p>
            </header>

            {/* 1 — The 5-step summary. This is what 90% of readers actually need. */}
            <section className="privacy__section handoff__section">
              <h2>{t.quickSummary.title}</h2>
              <p className="handoff__section-sub">{t.quickSummary.sub}</p>
              <ol className="handoff-steps">
                {t.quickSummary.steps.map((s) => (
                  <li key={s.h} className="handoff-steps__item">
                    <h3>{s.h}</h3>
                    <p>{s.p}</p>
                  </li>
                ))}
              </ol>
            </section>

            {/* 2 — Managed-mode parenthetical. */}
            <section className="privacy__section handoff__section">
              <h2>{t.managed.title}</h2>
              <p>{t.managed.body}</p>
            </section>

            {/* 3 — Dormancy. Kept visible (not collapsed) because it's the
                trust mechanism for managed mode and worth being prominent. */}
            <section className="privacy__section handoff__section">
              <h2>{t.dormancy.title}</h2>
              <p>{t.dormancy.lead}</p>
              {/* Trusted i18n string with <strong> + <code> — same pattern as
                  Privacy.tsx and FAQ.tsx. */}
              <p dangerouslySetInnerHTML={{ __html: t.dormancy.threshold }} />
              <ol className="handoff-steps">
                {t.dormancy.steps.map((s) => (
                  <li key={s.h} className="handoff-steps__item">
                    <h3>{s.h}</h3>
                    <p>{s.p}</p>
                  </li>
                ))}
              </ol>
              <p dangerouslySetInnerHTML={{ __html: t.dormancy.ending }} />
            </section>

            {/* 4 — Collapsed technical detail. Different audience (the next
                dev), so it's out of the way for the typical reader. */}
            <details className="handoff-tech">
              <summary>
                <span className="handoff-tech__title">{t.technical.title}</span>
                <span className="handoff-tech__marker mono" aria-hidden="true">
                  +
                </span>
              </summary>
              <p className="handoff-tech__lead">{t.technical.lead}</p>
              {t.technical.sections.map((s) => (
                <section key={s.h} className="handoff-tech__section">
                  <h3>{s.h}</h3>
                  <ol className="handoff-tech__steps">
                    {s.steps.map((step, idx) => (
                      <li key={idx}>{step}</li>
                    ))}
                  </ol>
                </section>
              ))}
            </details>

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
