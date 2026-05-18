// Vouch submission page (/vouch + /en/vouch). Open form — no auth.
// Visitor types name, email, relationship, body, optional link; submits
// to POST /api/vouches. Server moderates before anything is public.
//
// Validation philosophy: mirror the server's VOUCH_LIMITS client-side so
// the visitor sees inline errors before sending. On 4xx, map the server's
// `error` string to a friendly localized message; on 429 show the
// rate-limit copy; on anything else fall back to the generic error.

import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Footer } from '../components/Footer'
import { Header } from '../components/Header'
import { DICT, type Lang } from '../i18n'
import { ApiError } from '../lib/api'
import {
  VOUCH_LIMITS,
  VOUCH_RELATIONSHIPS,
  submitVouch,
  type VouchRelationship,
} from '../lib/vouchesApi'

interface FieldErrors {
  name?: string
  email?: string
  relationship?: string
  body?: string
  linkUrl?: string
}

export function Vouch({ lang }: { lang: Lang }) {
  const t = DICT[lang].vouches
  const ts = t.submit
  const langPrefix = lang === 'en' ? '/en' : ''

  // Optional session attribution via `?for=<id>`. When present, we ship it
  // with the submission and surface a contextual hint above the form so
  // the visitor knows what project this vouch is being filed under. Server
  // validates the session exists; an invalid id 400s and gets mapped to
  // the generic error.
  const [searchParams] = useSearchParams()
  const sessionFor = searchParams.get('for') || ''

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [relationship, setRelationship] = useState<VouchRelationship | ''>('')
  const [body, setBody] = useState('')
  const [linkUrl, setLinkUrl] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [globalError, setGlobalError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    document.title = `${ts.pageTitle} — Marc`
  }, [ts])

  // Mirror server-side validation so visitors see errors inline. Returns
  // `null` if everything is clean, otherwise the populated error map.
  function validate(): FieldErrors | null {
    const errs: FieldErrors = {}
    const trimmedName = name.trim()
    if (trimmedName.length < VOUCH_LIMITS.nameMin || trimmedName.length > VOUCH_LIMITS.nameMax) {
      errs.name = ts.errors.invalidName
    }
    const trimmedEmail = email.trim()
    if (!/\S+@\S+\.\S+/.test(trimmedEmail) || trimmedEmail.length > VOUCH_LIMITS.emailMax) {
      errs.email = ts.errors.invalidEmail
    }
    if (!relationship) {
      errs.relationship = ts.errors.invalidRelationship
    }
    const trimmedBody = body.trim()
    if (trimmedBody.length < VOUCH_LIMITS.bodyMin || trimmedBody.length > VOUCH_LIMITS.bodyMax) {
      errs.body = ts.errors.invalidBody
    }
    const trimmedLink = linkUrl.trim()
    if (trimmedLink.length > 0) {
      if (trimmedLink.length > VOUCH_LIMITS.linkUrlMax) {
        errs.linkUrl = ts.errors.invalidLink
      } else {
        try {
          const u = new URL(trimmedLink)
          if (u.protocol !== 'http:' && u.protocol !== 'https:') {
            errs.linkUrl = ts.errors.invalidLink
          }
        } catch {
          errs.linkUrl = ts.errors.invalidLink
        }
      }
    }
    return Object.keys(errs).length === 0 ? null : errs
  }

  // Live body counter — drives the hint label and helps people land in
  // the 30..600 sweet spot without hitting submit-time errors.
  const bodyLength = body.trim().length
  const bodyHint = useMemo(() => {
    if (bodyLength === 0) return ts.fields.bodyHint
    return `${bodyLength} / ${VOUCH_LIMITS.bodyMax}`
  }, [bodyLength, ts])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (submitting) return

    const errs = validate()
    if (errs) {
      setFieldErrors(errs)
      setGlobalError(null)
      return
    }
    setFieldErrors({})
    setGlobalError(null)
    setSubmitting(true)
    try {
      await submitVouch({
        authorName: name.trim(),
        authorEmail: email.trim(),
        relationship: relationship as VouchRelationship,
        body: body.trim(),
        linkUrl: linkUrl.trim() || undefined,
        sessionId: sessionFor || undefined,
      })
      setSubmitted(true)
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 429) setGlobalError(ts.errors.rateLimit)
        else if (err.status === 400) {
          // Map the server's tag to the right field. Server tags are stable
          // strings; see functions/api/vouches.ts for the source of truth.
          const tag = err.message
          if (tag.includes('name')) setFieldErrors({ name: ts.errors.invalidName })
          else if (tag.includes('email')) setFieldErrors({ email: ts.errors.invalidEmail })
          else if (tag.includes('relationship'))
            setFieldErrors({ relationship: ts.errors.invalidRelationship })
          else if (tag.includes('body')) setFieldErrors({ body: ts.errors.invalidBody })
          else if (tag.includes('link')) setFieldErrors({ linkUrl: ts.errors.invalidLink })
          else setGlobalError(ts.errors.generic)
        } else {
          setGlobalError(ts.errors.generic)
        }
      } else {
        setGlobalError(ts.errors.generic)
      }
    } finally {
      setSubmitting(false)
    }
  }

  function reset() {
    setName('')
    setEmail('')
    setRelationship('')
    setBody('')
    setLinkUrl('')
    setSubmitted(false)
    setFieldErrors({})
    setGlobalError(null)
  }

  if (submitted) {
    return (
      <>
        <Header lang={lang} />
        <main className="page">
          <section className="page__panel">
            <h1>{ts.successHeading}</h1>
            <p>{ts.successBody}</p>
            <p>
              <button type="button" className="hero__cta" onClick={reset}>
                {ts.submitAnother}
              </button>
            </p>
            <p>
              {/* If the visitor arrived via /vouch?for=:id, the natural
                  next destination is the project page they were just
                  vouching about — surface it ahead of "back home". */}
              {sessionFor && (
                <>
                  <Link to={`${langPrefix}/share/${encodeURIComponent(sessionFor)}`}>
                    {ts.backToProject}
                  </Link>
                  {' · '}
                </>
              )}
              <Link to={langPrefix || '/'}>{ts.backHome}</Link>
            </p>
          </section>
        </main>
        <Footer lang={lang} />
      </>
    )
  }

  return (
    <>
      <Header lang={lang} />
      <main className="page">
        <section className="page__panel">
          <h1>{ts.heading}</h1>
          <p>{ts.lead}</p>
          {sessionFor && (
            <p className="field__hint vouch-form__for-project">
              {ts.forProjectPrefix}{' '}
              <Link to={`${langPrefix}/share/${encodeURIComponent(sessionFor)}`}>
                {ts.forProjectLink}
              </Link>
              {ts.forProjectSuffix}
            </p>
          )}
          <p className="field__hint">{ts.privacy}</p>
          {globalError && (
            <p role="alert" className="form__error">
              {globalError}
            </p>
          )}
          <form onSubmit={onSubmit} className="form" noValidate>
            <div className="field">
              <label htmlFor="v-name" className="field__label">
                {ts.fields.nameLabel}
              </label>
              <input
                id="v-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={ts.fields.namePlaceholder}
                className="field__input"
                autoComplete="name"
                maxLength={VOUCH_LIMITS.nameMax}
                required
              />
              {fieldErrors.name && (
                <p role="alert" className="field__hint field__hint--error">
                  {fieldErrors.name}
                </p>
              )}
            </div>

            <div className="field">
              <label htmlFor="v-email" className="field__label">
                {ts.fields.emailLabel}
              </label>
              <input
                id="v-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={ts.fields.emailPlaceholder}
                className="field__input"
                autoComplete="email"
                maxLength={VOUCH_LIMITS.emailMax}
                required
              />
              <p className="field__hint">{ts.fields.emailHint}</p>
              {fieldErrors.email && (
                <p role="alert" className="field__hint field__hint--error">
                  {fieldErrors.email}
                </p>
              )}
            </div>

            <div className="field">
              <label htmlFor="v-rel" className="field__label">
                {ts.fields.relationshipLabel}
              </label>
              <select
                id="v-rel"
                value={relationship}
                onChange={(e) => setRelationship(e.target.value as VouchRelationship | '')}
                className="field__input"
                required
              >
                <option value="">—</option>
                {VOUCH_RELATIONSHIPS.map((r) => (
                  <option key={r} value={r}>
                    {t.relationshipLabels[r]}
                  </option>
                ))}
              </select>
              {fieldErrors.relationship && (
                <p role="alert" className="field__hint field__hint--error">
                  {fieldErrors.relationship}
                </p>
              )}
            </div>

            <div className="field">
              <label htmlFor="v-body" className="field__label">
                {ts.fields.bodyLabel}
              </label>
              <textarea
                id="v-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder={ts.fields.bodyPlaceholder}
                className="field__input"
                rows={6}
                maxLength={VOUCH_LIMITS.bodyMax}
                required
              />
              <p className="field__hint">{bodyHint}</p>
              {fieldErrors.body && (
                <p role="alert" className="field__hint field__hint--error">
                  {fieldErrors.body}
                </p>
              )}
            </div>

            <div className="field">
              <label htmlFor="v-link" className="field__label">
                {ts.fields.linkLabel}
              </label>
              <input
                id="v-link"
                type="url"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder={ts.fields.linkPlaceholder}
                className="field__input"
                maxLength={VOUCH_LIMITS.linkUrlMax}
              />
              <p className="field__hint">{ts.fields.linkHint}</p>
              {fieldErrors.linkUrl && (
                <p role="alert" className="field__hint field__hint--error">
                  {fieldErrors.linkUrl}
                </p>
              )}
            </div>

            <button type="submit" disabled={submitting} className="hero__cta">
              {submitting ? ts.submitting : ts.submitButton}
            </button>
          </form>
        </section>
      </main>
      <Footer lang={lang} />
    </>
  )
}
