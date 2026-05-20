import { useEffect } from 'react'
import type { Lang } from '../i18n'
import { Header } from '../components/Header'
import { Footer } from '../components/Footer'
import { PageMast } from '../components/PageMast'
import { SectionEyebrow } from '../components/SectionEyebrow'
import { PAGE_FOLIOS } from '../lib/folios'
import { PAGE_FEATURE } from '../lib/features'

/**
 * Bilingual page explaining the two ownership modes offered at engagement close
 * ("Tout à toi" vs "Je m'en occupe"). The FAQ promise that the visitor never
 * gets locked in lives here in operational detail: what gets transferred, the
 * closing ritual, the dormancy kill-switch that makes the managed mode honest.
 * Linked from Footer, Pricing Tier 2 addendum, and About.
 */

const COPY = {
  fr: {
    pageTitle: 'Comment ça finit — Marc',
    metaDescription:
      "Deux modes au moment de la livraison : Tout à toi, ou Je m'en occupe. Aucun ne te coince.",
    backHome: "← Retour à l'accueil",
    eyebrow: 'comment ça finit',
    title: "Tu n'es jamais pris au piège",
    lead: "À la livraison, deux modes : je m'en occupe, ou tout à toi. Aucun ne te coince — et tu peux changer d'idée n'importe quand.",
    asOf: 'En vigueur : 2026-05-15.',

    modes: {
      title: 'Les deux modes',
      sub: 'Mêmes livrables, mêmes garanties. Seule change la question de qui détient les clés.',
      items: [
        {
          name: "Je m'en occupe",
          id: 'je-men-occupe',
          eyebrow: 'mode par défaut · recommandé',
          lead: "Je garde les clés et j'opère ton site. Tu peux reprendre la garde quand tu veux.",
          bullets: [
            'Je détiens repo, domaine et comptes en mon nom (en dépositaire)',
            'Je gère DNS, renouvellements de domaine, certificats, mises à jour de sécurité',
            'Resend (SPF, DKIM, DMARC), Cloudflare Pages, exports D1 : à mon nom, sous ma responsabilité',
            'Petites retouches incluses (jusqu’à 2 h / mois)',
            "Au-delà de 2 h, je facture à l'heure (au tarif Tier 2), seulement après ton OK",
            'Renouvellement annuel ; si non renouvelé, bascule automatique vers « Tout à toi »',
          ],
          cost: '200 $ / an (couvre domaine + petites retouches + ops)',
          autonomy:
            "Tu peux basculer vers « Tout à toi » n'importe quand, gratuit, en environ une semaine. Aucun frais de sortie, aucune question.",
        },
        {
          name: 'Tout à toi',
          id: 'tout-a-toi',
          eyebrow: 'à la place du dépositaire',
          lead: 'Tu reprends tout à ton nom à la livraison. Pour visiteurs déjà à l’aise avec leur stack.',
          bullets: [
            'Le repo GitHub passe sous ton compte (ou celui de ton entreprise)',
            'Le domaine est enregistré à ton nom chez le registrar de ton choix',
            'Le compte Cloudflare (hébergement) et Resend (courriels) sont à toi',
            'Tu gères DNS, renouvellements, certificats, secrets — Marc n’assure plus le service',
          ],
          skillsIntro:
            'Avant de pouvoir confirmer ce mode à la livraison, tu attestes savoir gérer les six points ci-dessous. Le mode dépositaire existe précisément parce que ces tâches sont fastidieuses — si tu coches sans les connaître, tu prends le risque d’un site qui casse silencieusement et que Marc ne dépannera pas gratuitement.',
          skillsHeading: 'Tu sais gérer :',
          skills: [
            'Enregistrements DNS (A, CNAME, MX, TXT) chez mon registrar',
            'Déploiements Cloudflare Pages (env, domaine, rollback)',
            'Migrations et exports D1 (SQLite, secrets de connexion)',
            'Resend (SPF, DKIM, DMARC) pour mon domaine',
            'Rotation des clés API et secrets HMAC',
            'Admin GitHub (collaborateurs, branches, déploiements)',
          ],
          cost: 'Gratuit. Réservé aux visiteurs autonomes côté ops.',
          autonomy:
            "Tu peux migrer ou tout reprendre à n'importe quel moment, sans question. Rien à dénouer.",
        },
      ],
    },

    assets: {
      title: 'Ce qui te revient',
      sub: 'La liste exacte des choses qui te sont transférées. Identique dans les deux modes — seul change le moment où ça t’atterrit dans les mains.',
      items: [
        {
          h: 'Le code',
          p: 'Repo Git complet (GitHub), historique inclus. Transféré à ton compte ou cloné dans le tien.',
        },
        {
          h: 'Le nom de domaine',
          p: 'Enregistré chez OVH, Namecheap ou le registrar que tu choisis. Tu détiens le code de transfert.',
        },
        {
          h: "L'hébergement",
          p: "Cloudflare Pages — soit l'ownership du projet est transféré à ton compte Cloudflare, soit je te fournis les instructions pour rebâtir le déploiement chez toi.",
        },
        {
          h: 'La base de données',
          p: 'Cloudflare D1 — export complet au format SQLite, livré chiffré. Tu peux la rebrancher sur un nouveau déploiement en une commande.',
        },
        {
          h: 'Le service de courriels',
          p: 'Resend — accès au compte transféré, records SPF/DKIM documentés pour ton domaine.',
        },
        {
          h: 'Les secrets',
          p: "Toutes les clés (HMAC, jetons d'API) sont régénérées à la livraison — tu pars avec des secrets neufs, je n'ai plus accès.",
        },
        {
          h: 'La documentation',
          p: 'Un README de 2 pages : comment déployer, comment ajouter un champ, qui contacter pour quoi. Plus le tag git `v1.0-handoff`.',
        },
      ],
    },

    ritual: {
      title: 'Le rituel de transfert',
      sub: 'À quoi ressemble la journée de livraison — concret, court, sans surprise.',
      steps: [
        {
          h: '1. Confirmation (1 semaine avant)',
          p: "Je t'écris : on confirme le mode (« Tout à toi » ou « Je m'en occupe »), tu me donnes le compte cible (GitHub, registrar, Cloudflare) si on bascule en « Tout à toi ».",
        },
        {
          h: '2. Session de 30 minutes',
          p: 'Un appel court (ou écrit, à ton choix) : on passe la checklist ensemble, asset par asset. Tu signes une acceptation simple.',
        },
        {
          h: '3. Tag final',
          p: 'Je marque le commit final avec `v1.0-handoff` et ton nom — c’est le repère permanent dans l’historique git.',
        },
        {
          h: '4. Courriel récap',
          p: "Tu reçois un courriel avec tous les identifiants, liens et procédures. Tout ce qu'il te faut pour continuer seul (ou avec un autre dev).",
        },
        {
          h: '5. Garantie de 90 jours',
          p: "Pendant 90 jours après la livraison, je règle gratuitement tout bug introduit par mon code. Au-delà, c'est au tarif horaire — et seulement si tu en redemandes.",
        },
      ],
    },

    dormancy: {
      title: 'Et si je deviens injoignable?',
      body: "C'est la situation à laquelle « Je m'en occupe » doit résister. Si je ne réponds pas à un courriel dans les 30 jours, une procédure publiée te permet de prendre la pleine propriété toi-même, unilatéralement. La page « Checklist de transfert » contient la procédure exacte (tu peux l'imprimer) — tu n'as rien à demander à personne. C'est la sécurité qui rend ce mode honnête.",
    },

    faqs: {
      title: 'Questions courantes',
      items: [
        {
          q: "Et si je choisis « Je m'en occupe » et je ne paie pas le renouvellement?",
          a: "Le mode bascule automatiquement vers « Tout à toi » — pas de coupure, pas de chantage. Je transfère les comptes à ton nom, je t'envoie les instructions, et c'est fini. C'est exactement comme si tu avais choisi « Tout à toi » dès le début.",
        },
        {
          q: 'Le tarif annuel couvre quoi exactement?',
          a: "Le coût du domaine (~15 $/an, je passe au prix coûtant), le monitoring de santé du site, les mises à jour de sécurité automatiques, et jusqu'à 2 heures de petites retouches par mois (changer un texte, ajuster une couleur, ajouter un champ simple). Au-delà, je facture à l'heure au tarif Tier 2 — on en parle avant, jamais de surprise.",
        },
        {
          q: 'Est-ce que je peux changer de mode plus tard?',
          a: "Oui, dans les deux sens, gratuitement. Le mode est confirmé à la livraison mais ce n'est pas un contrat à vie.",
        },
        {
          q: 'Et si tu vends ta pratique ou tu arrêtes?',
          a: "Engagement explicite : si j'arrête mon side-gig, je passe tous les clients « Je m'en occupe » en « Tout à toi » avant de fermer, sans frais. Je n'ai pas l'intention de vendre — c'est une pratique solo qui n'existe pas sans moi.",
        },
      ],
    },

    cta: {
      title: 'Tu peux décider à la fin',
      body: "Le mode se choisit à la livraison, pas maintenant — et il n'est jamais définitif. Décris ton problème ; on verra le reste ensemble.",
      intakeCta: 'Ouvrir le formulaire →',
      pricingCta: 'Voir les prix',
      journeyCta: 'Voir le parcours complet (les 12 étapes) →',
    },
  },
  en: {
    pageTitle: 'How it ends — Marc',
    metaDescription: 'Two modes at engagement close: All yours, or I handle it. Neither traps you.',
    backHome: '← Back home',
    eyebrow: 'how it ends',
    title: 'You are never trapped',
    lead: 'At delivery, two modes: I handle it, or all yours. Neither traps you — and you can switch your mind anytime.',
    asOf: 'Effective: 2026-05-15.',

    modes: {
      title: 'The two modes',
      sub: 'Same deliverables, same guarantees. Only the question of who holds the keys changes.',
      items: [
        {
          name: 'I handle it',
          id: 'i-handle-it',
          eyebrow: 'default mode · recommended',
          lead: 'I hold the keys and operate your site. You can take them back anytime.',
          bullets: [
            'I hold repo, domain, and accounts in my name (as custodian)',
            'I manage DNS, domain renewals, TLS certificates, security updates',
            'Resend (SPF, DKIM, DMARC), Cloudflare Pages, D1 exports: in my name, on my hook',
            'Small tweaks included (up to 2h / month)',
            'Beyond 2h, I bill hourly (at the Tier 2 rate), only after you approve',
            "Annual renewal; if not renewed, auto-switch to 'All yours'",
          ],
          cost: '$200 / year (covers domain + small tweaks + ops)',
          autonomy:
            "You can switch to 'All yours' anytime, free, in about a week. No exit fee, no questions.",
        },
        {
          name: 'All yours',
          id: 'all-yours',
          eyebrow: 'opt out of custodian',
          lead: 'You take everything at delivery. For visitors already comfortable with their stack.',
          bullets: [
            "The GitHub repo moves under your account (or your company's)",
            'The domain is registered in your name at the registrar of your choice',
            'Cloudflare (hosting) and Resend (email) accounts are yours',
            "You manage DNS, renewals, certificates, secrets — I'm no longer on the hook",
          ],
          skillsIntro:
            "Before you can confirm this mode at delivery, you attest you can handle the six items below. Custodian mode exists precisely because these tasks are tedious — if you tick without knowing them, you risk a site that breaks quietly and Marc won't fix for free.",
          skillsHeading: 'You can handle:',
          skills: [
            'DNS records (A, CNAME, MX, TXT) at my registrar',
            'Cloudflare Pages deploys (env, domain, rollback)',
            'D1 migrations and exports (SQLite, connection secrets)',
            'Resend (SPF, DKIM, DMARC) for my domain',
            'Rotating API keys and HMAC secrets',
            'GitHub admin (collaborators, branches, deploys)',
          ],
          cost: 'Free. For visitors who already own the ops stack.',
          autonomy:
            'You can migrate or take everything over at any time, no questions asked. Nothing to untangle.',
        },
      ],
    },

    assets: {
      title: 'What you get',
      sub: 'The exact list of things transferred to you. Identical in both modes — only the moment of transfer changes.',
      items: [
        {
          h: 'The code',
          p: 'Full Git repo (GitHub), history included. Transferred to your account or cloned into it.',
        },
        {
          h: 'The domain name',
          p: 'Registered at OVH, Namecheap, or the registrar you pick. You hold the transfer code.',
        },
        {
          h: 'Hosting',
          p: 'Cloudflare Pages — either project ownership is transferred to your Cloudflare account, or I hand you the instructions to rebuild the deployment in yours.',
        },
        {
          h: 'The database',
          p: 'Cloudflare D1 — full SQLite export, delivered encrypted. You can plug it into a new deployment with one command.',
        },
        {
          h: 'The email service',
          p: 'Resend — account access transferred, SPF/DKIM records documented for your domain.',
        },
        {
          h: 'The secrets',
          p: 'All keys (HMAC, API tokens) are regenerated at handoff — you leave with fresh secrets, I no longer have access.',
        },
        {
          h: 'The documentation',
          p: 'A 2-page README: how to deploy, how to add a field, who to contact for what. Plus the git tag `v1.0-handoff`.',
        },
      ],
    },

    ritual: {
      title: 'The handoff ritual',
      sub: 'What the delivery day looks like — concrete, short, no surprises.',
      steps: [
        {
          h: '1. Confirmation (1 week out)',
          p: "I email you: we confirm the mode ('All yours' or 'I handle it'), you give me the target account (GitHub, registrar, Cloudflare) if switching to 'All yours'.",
        },
        {
          h: '2. 30-minute session',
          p: 'A short call (or written, your choice): we walk the checklist together, asset by asset. You sign a simple acceptance.',
        },
        {
          h: '3. Final tag',
          p: 'I tag the final commit `v1.0-handoff` with your name — the permanent marker in the git history.',
        },
        {
          h: '4. Recap email',
          p: 'You receive an email with all credentials, links, and procedures. Everything you need to continue alone (or with another dev).',
        },
        {
          h: '5. 90-day warranty',
          p: "For 90 days after delivery, I fix any bug introduced by my code, free. Beyond that, it's hourly — and only if you ask.",
        },
      ],
    },

    dormancy: {
      title: 'What if I become unreachable?',
      body: "This is the scenario 'I handle it' must survive. If I don't reply to an email within 30 days, a published procedure lets you take full ownership yourself, unilaterally. The 'Handoff checklist' page carries the exact procedure (printable) — you don't have to ask anyone. It's the safety mechanism that makes this mode honest.",
    },

    faqs: {
      title: 'Common questions',
      items: [
        {
          q: "What if I pick 'I handle it' and don't pay the renewal?",
          a: "The mode auto-switches to 'All yours' — no service cutoff, no leverage play. I transfer the accounts into your name, I send the instructions, and we're done. Exactly as if you'd picked 'All yours' from the start.",
        },
        {
          q: 'What does the annual fee cover, exactly?',
          a: 'Domain cost (~$15/yr, pass-through), site health monitoring, automatic security updates, and up to 2 hours of small tweaks per month (change a text, adjust a color, add a simple field). Beyond that, hourly at the Tier 2 rate — we discuss first, no surprises.',
        },
        {
          q: 'Can I change modes later?',
          a: "Yes, both ways, free. The mode is confirmed at delivery but it's not a lifetime contract.",
        },
        {
          q: 'What if you sell or shut down the practice?',
          a: "Explicit commitment: if I shut down the side-gig, I switch every 'I handle it' client to 'All yours' before closing, no fee. I have no intention to sell — this is a solo practice that doesn't exist without me.",
        },
      ],
    },

    cta: {
      title: 'You can decide at the end',
      body: "You pick the mode at delivery, not now — and it's never final. Describe your problem; we'll sort the rest together.",
      intakeCta: 'Open the form →',
      pricingCta: 'See pricing',
      journeyCta: 'See the full journey (all 12 steps) →',
    },
  },
} as const

export function Handoff({ lang }: { lang: Lang }) {
  const t = COPY[lang]
  const langPrefix = lang === 'fr' ? '' : '/en'

  useEffect(() => {
    document.documentElement.lang = lang === 'fr' ? 'fr-CA' : 'en-CA'
    document.title = t.pageTitle
    const meta = document.querySelector('meta[name="description"]')
    if (meta) meta.setAttribute('content', t.metaDescription)
  }, [lang, t])

  return (
    <div className="app" data-feature={PAGE_FEATURE['page.handoff']}>
      <Header lang={lang} />
      <main id="main-content">
        <article className="section">
          <div className="section__inner privacy handoff">
            <PageMast
              folio={
                lang === 'fr'
                  ? `№ ${PAGE_FOLIOS.handoff} — comment ça finit`
                  : `№ ${PAGE_FOLIOS.handoff} — how it ends`
              }
              stampLabel={lang === 'fr' ? 'PASSATION' : 'HANDOFF'}
              stampSub={lang === 'fr' ? 'SANS PIÈGE' : 'NO LOCK-IN'}
              back={{ href: lang === 'fr' ? '/' : '/en', label: t.backHome }}
              feature={PAGE_FEATURE['page.handoff']}
              lang={lang}
            >
              <SectionEyebrow lang={lang} feature={PAGE_FEATURE['page.handoff']}>
                {t.eyebrow}
              </SectionEyebrow>
              <h1>{t.title}</h1>
              <p className="privacy__intro">{t.lead}</p>
              <p className="mono privacy__asof">{t.asOf}</p>
            </PageMast>

            <section className="handoff__modes">
              <h2>{t.modes.title}</h2>
              <p className="handoff__section-sub">{t.modes.sub}</p>
              <div className="handoff-modes-grid">
                {t.modes.items.map((m, i) => (
                  <article
                    key={m.name}
                    id={'id' in m ? m.id : undefined}
                    className={`handoff-mode${i === 0 ? ' handoff-mode--default' : ' handoff-mode--managed'}`}
                  >
                    <div className="handoff-mode__eyebrow mono">{m.eyebrow}</div>
                    <h3 className="handoff-mode__name">{m.name}</h3>
                    <p className="handoff-mode__lead">{m.lead}</p>
                    <ul className="handoff-mode__bullets">
                      {m.bullets.map((b) => (
                        <li key={b}>{b}</li>
                      ))}
                    </ul>
                    {'skills' in m && (
                      <div className="handoff-mode__skills-block">
                        <p className="handoff-mode__skills-intro">{m.skillsIntro}</p>
                        <p className="handoff-mode__skills-heading mono">{m.skillsHeading}</p>
                        <ul className="handoff-mode__skills">
                          {m.skills.map((s) => (
                            <li key={s}>{s}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <p className="handoff-mode__cost mono">{m.cost}</p>
                    <p className="handoff-mode__autonomy">{m.autonomy}</p>
                  </article>
                ))}
              </div>
            </section>

            <section className="privacy__section handoff__section">
              <h2>{t.assets.title}</h2>
              <p className="handoff__section-sub">{t.assets.sub}</p>
              <dl className="handoff-assets">
                {t.assets.items.map((a) => (
                  <div key={a.h} className="handoff-assets__row">
                    <dt>{a.h}</dt>
                    <dd>{a.p}</dd>
                  </div>
                ))}
              </dl>
              <p className="handoff__checklist-link">
                <a href={`${langPrefix}/handoff/checklist`} className="link-btn mono">
                  {lang === 'fr'
                    ? 'Voir la checklist détaillée (commandes, comptes, étape par étape) →'
                    : 'See the detailed checklist (commands, accounts, step by step) →'}
                </a>
              </p>
            </section>

            <section className="privacy__section handoff__section">
              <h2>{t.ritual.title}</h2>
              <p className="handoff__section-sub">{t.ritual.sub}</p>
              <ol className="handoff-steps">
                {t.ritual.steps.map((s) => (
                  <li key={s.h} className="handoff-steps__item">
                    <h3>{s.h}</h3>
                    <p>{s.p}</p>
                  </li>
                ))}
              </ol>
            </section>

            <section className="privacy__section handoff__section">
              <h2>{t.dormancy.title}</h2>
              <p>{t.dormancy.body}</p>
            </section>

            <section className="privacy__section handoff__section">
              <h2>{t.faqs.title}</h2>
              <div className="handoff-faqs">
                {t.faqs.items.map((qa) => (
                  <details key={qa.q} className="handoff-faqs__item">
                    <summary>{qa.q}</summary>
                    <p>{qa.a}</p>
                  </details>
                ))}
              </div>
            </section>

            <section className="handoff__cta">
              <h2>{t.cta.title}</h2>
              <p>{t.cta.body}</p>
              <div className="handoff__cta-actions">
                <a href={`${langPrefix}/intake`} className="hero__cta">
                  {t.cta.intakeCta}
                </a>
                <a href={`${langPrefix}/#pricing`} className="link-btn mono">
                  {t.cta.pricingCta}
                </a>
                <a href={lang === 'fr' ? '/parcours' : '/en/journey'} className="link-btn mono">
                  {t.cta.journeyCta}
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
