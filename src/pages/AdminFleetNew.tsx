/**
 * /admin/fleet/new — operator wizard to provision a buyer instance.
 *
 * MVP scope: writes the tenant + tenant_domains rows; emits an audit_log
 * entry. The Cloudflare Pages custom-domain-add API call is NOT yet wired
 * (feat-2026-018) — operators must add the domain in the CF dashboard and
 * the buyer points DNS. The wizard surfaces the next-step instructions.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Lang } from '../i18n'
import { api, ApiError } from '../lib/api'

const COPY = {
  fr: {
    eyebrow: 'nouveau client',
    title: 'Provisionner un nouveau client',
    sub: 'Crée l’instance, l’envoi du lien magique et la suite des opérations.',
    slug: 'Slug (interne, immuable)',
    slugHint: 'Lettres minuscules, chiffres, traits d’union. Apparaît dans les logs et URLs internes.',
    ownerEmail: 'Courriel du propriétaire',
    ownerEmailHint: 'Personne qui paie + reçoit le lien magique pour gérer son app.',
    domain: 'Domaine (sans https://)',
    domainHint: 'Ex : roger-voice-truck.com — l’acheteur pointera son DNS ici.',
    template: 'App à installer',
    displayName: 'Nom affiché (optionnel)',
    displayNameHint: 'Ex : Roger Voice Truck. Modifiable plus tard par le client.',
    submit: 'Provisionner →',
    submitting: 'Provisionnement…',
    next: 'Prochaine étape',
    nextBody:
      'Le client a été créé en état "en attente". Il faut maintenant : (1) ajouter ce domaine dans le projet Cloudflare Pages (Settings → Custom domains), (2) demander au client de pointer son DNS, (3) attendre la propagation SSL. La page Flotte montre l’état SSL en direct.',
    cancel: '← Retour à la flotte',
    error: 'Quelque chose a mal tourné.',
  },
  en: {
    eyebrow: 'new buyer',
    title: 'Provision a new buyer',
    sub: 'Creates the instance, sends the magic link, and queues the rest of the steps.',
    slug: 'Slug (internal, immutable)',
    slugHint: 'Lowercase letters, digits, hyphens. Appears in logs and internal URLs.',
    ownerEmail: 'Owner email',
    ownerEmailHint: 'The person paying + receiving the magic link to manage their app.',
    domain: 'Domain (no https://)',
    domainHint: 'e.g. roger-voice-truck.com — the buyer will point DNS here.',
    template: 'App to install',
    displayName: 'Display name (optional)',
    displayNameHint: 'e.g. Roger Voice Truck. Buyer can change later.',
    submit: 'Provision →',
    submitting: 'Provisioning…',
    next: 'Next step',
    nextBody:
      'The buyer has been created with status "pending". Now you need to: (1) add this domain to the Cloudflare Pages project (Settings → Custom domains), (2) ask the buyer to point their DNS here, (3) wait for SSL provisioning. The Fleet page shows live SSL status.',
    cancel: '← Back to fleet',
    error: 'Something went wrong.',
  },
} as const

const TEMPLATES = [
  { id: 'snd', label: 'Sunday Night Dread', version: '1.0' },
  { id: 'volunteer-roster', label: 'Volunteer Roster', version: '0.1' },
]

export function AdminFleetNew({ lang }: { lang: Lang }) {
  const t = COPY[lang]
  const navigate = useNavigate()
  const langPrefix = lang === 'en' ? '/en' : ''

  const [slug, setSlug] = useState('')
  const [ownerEmail, setOwnerEmail] = useState('')
  const [domain, setDomain] = useState('')
  const [templateId, setTemplateId] = useState(TEMPLATES[0].id)
  const [displayName, setDisplayName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<{ slug: string; domain: string } | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setError(null)
    const tpl = TEMPLATES.find((x) => x.id === templateId)
    try {
      await api<{ tenant: { slug: string; domain: string } }>('/api/admin/fleet', {
        method: 'POST',
        body: {
          slug,
          ownerEmail,
          domain,
          templateId,
          templateVersion: tpl?.version ?? '1.0',
          displayName: displayName || undefined,
        },
      })
      setDone({ slug, domain })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'unknown error')
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div className="admin-page">
        <header className="admin-page__head">
          <div className="section__eyebrow">{t.eyebrow}</div>
          <h1>✓ {done.slug}</h1>
          <p className="mono">{done.domain}</p>
        </header>
        <section className="admin-block">
          <h2>{t.next}</h2>
          <p>{t.nextBody}</p>
          <div style={{ marginTop: 18 }}>
            <button
              type="button"
              className="hero__cta"
              onClick={() => navigate(`${langPrefix}/admin/fleet`)}
            >
              {t.cancel.replace('← ', '')}
            </button>
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className="admin-page">
      <header className="admin-page__head">
        <div className="section__eyebrow">{t.eyebrow}</div>
        <h1>{t.title}</h1>
        <p>{t.sub}</p>
      </header>

      <form className="admin-block" onSubmit={submit}>
        <div className="theme-fields">
          <label className="field">
            <span className="field__label">{t.template}</span>
            <select
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              className="field__input"
            >
              {TEMPLATES.map((tpl) => (
                <option key={tpl.id} value={tpl.id}>
                  {tpl.label} (v{tpl.version})
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span className="field__label">{t.slug}</span>
            <input
              required
              className="field__input mono"
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase())}
              placeholder="roger-voice-truck"
              pattern="[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?"
            />
            <span className="field__hint">{t.slugHint}</span>
          </label>

          <label className="field">
            <span className="field__label">{t.ownerEmail}</span>
            <input
              required
              type="email"
              autoComplete="off"
              className="field__input mono"
              value={ownerEmail}
              onChange={(e) => setOwnerEmail(e.target.value)}
              placeholder="roger@…"
            />
            <span className="field__hint">{t.ownerEmailHint}</span>
          </label>

          <label className="field">
            <span className="field__label">{t.domain}</span>
            <input
              required
              className="field__input mono"
              value={domain}
              onChange={(e) => setDomain(e.target.value.toLowerCase())}
              placeholder="roger-voice-truck.com"
            />
            <span className="field__hint">{t.domainHint}</span>
          </label>

          <label className="field">
            <span className="field__label">{t.displayName}</span>
            <input
              className="field__input"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Roger Voice Truck"
            />
            <span className="field__hint">{t.displayNameHint}</span>
          </label>
        </div>

        <div style={{ marginTop: 28, display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
          <button type="submit" className="hero__cta" disabled={submitting}>
            {submitting ? t.submitting : t.submit}
          </button>
          <button
            type="button"
            className="link-btn"
            onClick={() => navigate(`${langPrefix}/admin/fleet`)}
          >
            {t.cancel}
          </button>
          {error && <span className="form__error">{t.error} ({error})</span>}
        </div>
      </form>
    </div>
  )
}
