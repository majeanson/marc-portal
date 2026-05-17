// Resend wrapper. Free tier: 100/day, 3000/mo. Errors here are logged and
// swallowed so a transient Resend outage doesn't 500 user-facing endpoints
// — the magic link still gets stored.
//
// Sender: noreply@marcportal.com. PREREQUISITE before deploying this constant:
//   1. Add marcportal.com on Resend Dashboard → Domains → Add.
//   2. Add the 4 records Resend lists into Cloudflare DNS:
//        TXT  resend._domainkey   p=MIGfMA…QIDAQAB
//        MX   send                feedback-smtp.us-east-1.amazonses.com (pri 10)
//        TXT  send                v=spf1 include:amazonses.com ~all
//        TXT  _dmarc              v=DMARC1; p=none;
//      Resend uses the `send` subdomain pattern for bounce handling, so the
//      SPF and MX records do NOT collide with CF Email Routing's records at
//      the apex (different names = no merge required). DKIM selector
//      `resend._domainkey` similarly doesn't collide with CF's
//      `cf2024-1._domainkey`.
//   3. Wait for Resend to flip the domain status to "verified" (typically
//      2–10 min on Cloudflare's nameservers).
// Until verified, every send via this FROM fails with 403. If you need to
// deploy code BEFORE Resend verification finishes, temporarily revert to
// 'Marc Portal <onboarding@resend.dev>' (Resend's shared domain, no DNS
// required — degrades deliverability but doesn't break sends).
const RESEND_FROM = 'Marc Portal <noreply@marcportal.com>'
const RESEND_URL = 'https://api.resend.com/emails'

interface ResendPayload {
  from: string
  to: string
  subject: string
  html: string
  text: string
}

async function send(apiKey: string, payload: ResendPayload): Promise<boolean> {
  try {
    const res = await fetch(RESEND_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      console.error('resend send failed', res.status, await res.text())
      return false
    }
    return true
  } catch (err) {
    console.error('resend send threw', err)
    return false
  }
}

export async function sendMagicLink(
  apiKey: string,
  email: string,
  url: string,
  lang: 'fr' | 'en',
): Promise<boolean> {
  const subject = lang === 'fr' ? 'Ton lien de connexion' : 'Your sign-in link'
  const intro =
    lang === 'fr'
      ? 'Clique ce lien pour te connecter au portail de Marc. Il expire dans 30 minutes.'
      : "Click this link to sign in to Marc's portal. It expires in 30 minutes."
  const ignore =
    lang === 'fr'
      ? "Tu n'as pas demandé ce courriel ? Ignore-le."
      : "Didn't request this email? Ignore it."
  const html = `<!doctype html><html><body style="font-family:system-ui,sans-serif;max-width:480px;margin:auto;padding:24px;color:#1a1a1a">
<p>${intro}</p>
<p><a href="${url}" style="display:inline-block;padding:12px 18px;background:#d97706;color:#fff;text-decoration:none;border-radius:6px">${lang === 'fr' ? 'Se connecter' : 'Sign in'}</a></p>
<p style="color:#666;font-size:14px;word-break:break-all">${url}</p>
<p style="color:#999;font-size:12px;margin-top:32px">${ignore}</p>
</body></html>`
  const text = `${intro}\n\n${url}\n\n${ignore}`
  return send(apiKey, { from: RESEND_FROM, to: email, subject, html, text })
}

export async function sendVisitorMessageNotification(
  apiKey: string,
  marcEmail: string,
  visitorEmail: string,
  sessionId: string,
  origin: string,
  preview: string,
): Promise<boolean> {
  // Loi 25 / lock-screen privacy: keep the visitor's email out of the subject
  // line so a glance at Marc's notifications doesn't leak which client is
  // talking. The body still carries the full identifying info.
  const subject = 'New message in the portal'
  const url = `${origin}/admin/inbox/${sessionId}`
  const html = `<!doctype html><html><body style="font-family:system-ui,sans-serif;max-width:480px;margin:auto;padding:24px;color:#1a1a1a">
<p><strong>${visitorEmail}</strong> posted in their session:</p>
<blockquote style="border-left:3px solid #d97706;padding:8px 12px;color:#444;background:#faf7f2">${escapeHtml(preview).slice(0, 400)}</blockquote>
<p><a href="${url}">Open in admin inbox</a></p>
</body></html>`
  const text = `${visitorEmail} posted: ${preview.slice(0, 400)}\n\n${url}`
  return send(apiKey, { from: RESEND_FROM, to: marcEmail, subject, html, text })
}

/**
 * Marc replied in the visitor's session thread. Visitor gets an email with a
 * preview and a link to the session page (where they can read + reply).
 */
export async function sendMarcMessageNotification(
  apiKey: string,
  visitorEmail: string,
  sessionId: string,
  origin: string,
  preview: string,
  lang: 'fr' | 'en',
): Promise<boolean> {
  const subject = lang === 'fr' ? 'Marc a répondu à ta session' : 'Marc replied to your session'
  const intro =
    lang === 'fr'
      ? 'Marc a posté un message dans ta session :'
      : 'Marc posted a message in your session:'
  const cta = lang === 'fr' ? 'Ouvrir la session' : 'Open the session'
  const url = `${origin}${lang === 'fr' ? '' : '/en'}/session/${sessionId}`
  const html = `<!doctype html><html><body style="font-family:system-ui,sans-serif;max-width:480px;margin:auto;padding:24px;color:#1a1a1a">
<p>${intro}</p>
<blockquote style="border-left:3px solid #3d6e4e;padding:8px 12px;color:#444;background:#fbf7ec">${escapeHtml(preview).slice(0, 400)}</blockquote>
<p><a href="${url}" style="display:inline-block;padding:10px 16px;background:#3d6e4e;color:#fff;text-decoration:none;border-radius:6px">${cta}</a></p>
<p style="color:#999;font-size:12px;word-break:break-all">${url}</p>
</body></html>`
  const text = `${intro}\n\n${preview.slice(0, 400)}\n\n${cta}: ${url}`
  return send(apiKey, { from: RESEND_FROM, to: visitorEmail, subject, html, text })
}

/**
 * Status of the visitor's session changed. They get a short email in their
 * own language with the new status and a deep link to the session.
 */
export async function sendStatusChangeNotification(
  apiKey: string,
  visitorEmail: string,
  sessionId: string,
  fromStatus: string,
  toStatus: string,
  origin: string,
  lang: 'fr' | 'en',
): Promise<boolean> {
  const langPrefix = lang === 'en' ? '/en' : ''
  const url = `${origin}${langPrefix}/session/${sessionId}`
  const fromLabel = statusLabel(fromStatus, lang)
  const toLabel = statusLabel(toStatus, lang)
  const subject =
    lang === 'fr' ? `Ta session est maintenant : ${toLabel}` : `Your session is now: ${toLabel}`
  const lead =
    lang === 'fr'
      ? `Marc a déplacé ta session de <code>${escapeHtml(fromLabel)}</code> à <code>${escapeHtml(toLabel)}</code>.`
      : `Marc moved your session from <code>${escapeHtml(fromLabel)}</code> to <code>${escapeHtml(toLabel)}</code>.`
  const sub =
    lang === 'fr' ? 'Ouvre la session pour voir la suite.' : "Open the session to see what's next."
  const cta = lang === 'fr' ? 'Voir ma session' : 'Open my session'
  const html = `<!doctype html><html><body style="font-family:system-ui,sans-serif;max-width:480px;margin:auto;padding:24px;color:#1a1a1a">
<p><strong>${lead}</strong></p>
<p style="color:#444">${sub}</p>
<p><a href="${url}" style="display:inline-block;padding:10px 16px;background:#3d6e4e;color:#fff;text-decoration:none;border-radius:6px">${cta}</a></p>
<p style="color:#999;font-size:12px;word-break:break-all">${url}</p>
</body></html>`
  const text =
    lang === 'fr'
      ? `Marc a déplacé ta session de ${fromLabel} à ${toLabel}.\n\n${url}`
      : `Marc moved your session from ${fromLabel} to ${toLabel}.\n\n${url}`
  return send(apiKey, { from: RESEND_FROM, to: visitorEmail, subject, html, text })
}

/**
 * Visitor edited their own intake mid-flight. Marc gets a heads-up so he can
 * re-read before triaging — small change, possibly large reframe of the ask.
 */
export async function sendIntakeEditedNotification(
  apiKey: string,
  marcEmail: string,
  visitorEmail: string,
  sessionId: string,
  origin: string,
): Promise<boolean> {
  // Generic subject — body carries the identifying info. See the lock-screen
  // privacy comment in sendVisitorMessageNotification.
  const subject = 'A visitor edited their intake'
  const url = `${origin}/admin/inbox/${sessionId}`
  const html = `<!doctype html><html><body style="font-family:system-ui,sans-serif;max-width:480px;margin:auto;padding:24px;color:#1a1a1a">
<p><strong>${escapeHtml(visitorEmail)}</strong> updated their intake answers.</p>
<p style="color:#444">Re-read before triaging — they may have reframed the ask.</p>
<p><a href="${url}">Open in admin inbox</a></p>
</body></html>`
  const text = `${visitorEmail} updated their intake answers.\n\n${url}`
  return send(apiKey, { from: RESEND_FROM, to: marcEmail, subject, html, text })
}

/**
 * Symmetric counterparty notification on session withdrawal:
 *   - visitor self-withdrew → Marc gets the heads-up
 *   - admin force-withdrew → visitor gets a courtesy note
 * Both share copy: "session was withdrawn" + actor + link.
 */
export async function sendWithdrawalNotification(
  apiKey: string,
  toEmail: string,
  byEmail: string,
  sessionId: string,
  origin: string,
  lang: 'fr' | 'en',
  audience: 'admin' | 'visitor',
): Promise<boolean> {
  // Generic admin subject (no email leak on lock screen); the visitor-side
  // subject is already non-identifying.
  const subject =
    audience === 'admin'
      ? 'A session was withdrawn'
      : lang === 'fr'
        ? 'Ta session a été retirée du portail'
        : 'Your session was withdrawn from the portal'
  const url =
    audience === 'admin'
      ? `${origin}/admin/inbox/${sessionId}`
      : `${origin}${lang === 'en' ? '/en' : ''}/me`
  const lead =
    audience === 'admin'
      ? `<strong>${escapeHtml(byEmail)}</strong> withdrew their session. The row is soft-deleted but still visible in the admin trash.`
      : lang === 'fr'
        ? `Marc a retiré une session du portail. Si c'est une erreur, écris-lui — la session existe encore en arrière-plan.`
        : `Marc withdrew a session from the portal. If this was a mistake, reach out — the session still exists in the background.`
  const cta =
    audience === 'admin'
      ? 'Open in admin'
      : lang === 'fr'
        ? 'Voir mes sessions'
        : 'Open my sessions'
  const html = `<!doctype html><html><body style="font-family:system-ui,sans-serif;max-width:480px;margin:auto;padding:24px;color:#1a1a1a">
<p>${lead}</p>
<p><a href="${url}">${cta}</a></p>
</body></html>`
  const text = `${lead.replace(/<[^>]+>/g, '')}\n\n${url}`
  return send(apiKey, { from: RESEND_FROM, to: toEmail, subject, html, text })
}

/**
 * Tier-2 deposit just cleared — visitor gets a short transactional note
 * confirming receipt and pointing them back to /me where the "Pay final
 * balance" button is now active. The button itself is already wired in
 * PaymentActions.tsx; this is purely a nudge so the visitor doesn't wait
 * for Marc's manual follow-up.
 *
 * Called from the webhook handler on the FIRST transition of a
 * tier2-deposit payment row to status='paid'. Idempotency is enforced by
 * the caller (a re-delivered webhook must not re-send the email).
 */
export async function sendTier2DepositReceiptAndFinalPrompt(
  apiKey: string,
  visitorEmail: string,
  sessionId: string,
  origin: string,
  lang: 'fr' | 'en',
): Promise<boolean> {
  const langPrefix = lang === 'en' ? '/en' : ''
  const sessionUrl = `${origin}${langPrefix}/session/${sessionId}`
  const subject =
    lang === 'fr'
      ? 'Dépôt Tier 2 reçu — solde final disponible'
      : 'Tier 2 deposit received — final balance available'
  const lead =
    lang === 'fr'
      ? 'Ton dépôt (50 %) pour le projet Tier 2 est confirmé. Merci.'
      : 'Your Tier 2 deposit (50%) is confirmed. Thank you.'
  const body =
    lang === 'fr'
      ? 'Quand tu es prêt à payer le solde final (50 % restants), retourne sur la page de ta session — le bouton est maintenant actif.'
      : "When you're ready to pay the final balance (the remaining 50%), head back to your session page — the button is now active."
  const cta = lang === 'fr' ? 'Ouvrir ma session' : 'Open my session'
  const html = `<!doctype html><html><body style="font-family:system-ui,sans-serif;max-width:480px;margin:auto;padding:24px;color:#1a1a1a">
<p><strong>${lead}</strong></p>
<p style="color:#444">${body}</p>
<p><a href="${sessionUrl}" style="display:inline-block;padding:10px 16px;background:#3d6e4e;color:#fff;text-decoration:none;border-radius:6px">${cta}</a></p>
<p style="color:#999;font-size:12px;word-break:break-all">${sessionUrl}</p>
</body></html>`
  const text = `${lead}\n\n${body}\n\n${cta}: ${sessionUrl}`
  return send(apiKey, { from: RESEND_FROM, to: visitorEmail, subject, html, text })
}

/**
 * Marc assigned a tier to the visitor's session (or set the Tier-3 quote
 * amount for the first time on a tier-3 row). Visitor gets a short email
 * pointing them to the session page where the "Pay" button now lives.
 *
 * Called from PATCH /api/sessions/:id when:
 *   - tier transitions from null to a non-null value (any tier), OR
 *   - tier3_amount_cents transitions from null to a value on a tier=3 row
 *     (i.e. the quote that unlocks the visitor's self-pay button).
 *
 * Tier 0 still sends an email — it's the "free, here's the patron" outcome,
 * and the visitor needs to know Marc decided + where to look. The body
 * differs per tier so each path reads as the right kind of news.
 *
 * `amountCadCents` is the canonical billed amount (300 / 1500 / quote) used
 * to render an at-a-glance price line; null for tier 0 and for tier 3 when
 * no quote has been set yet (in which case this function shouldn't be
 * called — the caller is responsible).
 */
export async function sendTierAssignedNotification(
  apiKey: string,
  visitorEmail: string,
  sessionId: string,
  tier: 0 | 1 | 2 | 3,
  amountCadCents: number | null,
  origin: string,
  lang: 'fr' | 'en',
  /** True when this email fires from a Tier-3 *quote* that landed AFTER the
   *  session was already active (admin set tier=3 silently first, then the
   *  amount later). Lets the subject read "Quote ready" instead of
   *  "Marc accepted", since acceptance happened earlier. Ignored for
   *  tier 0/1/2 and for tier-3-with-quote-set-at-same-time. */
  isLateQuote: boolean = false,
): Promise<boolean> {
  const langPrefix = lang === 'en' ? '/en' : ''
  const sessionUrl = `${origin}${langPrefix}/session/${sessionId}`
  const priceLine = amountCadCents != null ? formatCadCents(amountCadCents, lang) : null

  // Per-tier subject + lead. Tier 0 is the "redirect to patron" exit; the
  // other three are paid engagements.
  let subject: string
  let lead: string
  let body: string
  let cta: string
  if (tier === 0) {
    subject = lang === 'fr' ? 'Marc t’a répondu — Tier 0 (gratuit)' : 'Marc replied — Tier 0 (free)'
    lead =
      lang === 'fr'
        ? 'Ton problème entre dans le Tier 0 : trop petit pour engager un dev.'
        : "Your problem fits Tier 0: too small to hire a dev for."
    body =
      lang === 'fr'
        ? 'Marc te redirige vers un patron prêt-à-utiliser ou un template — détails dans le fil de la session.'
        : 'Marc redirects you to a ready-made pattern or template — details in the session thread.'
    cta = lang === 'fr' ? 'Voir la suite' : "See what's next"
  } else if (tier === 2) {
    // Tier 2 is split — call out the 50/50 explicitly so the visitor
    // doesn't think the deposit IS the total.
    const halfLine = priceLine
      ? lang === 'fr'
        ? `Dépôt de ${formatCadCents(amountCadCents! / 2, lang)} pour démarrer (50 %), solde à la livraison.`
        : `Deposit of ${formatCadCents(amountCadCents! / 2, lang)} to start (50%), balance at delivery.`
      : ''
    subject =
      lang === 'fr'
        ? 'Marc accepte — Tier 2 (~1 500 $) · paie le dépôt pour démarrer'
        : 'Marc accepted — Tier 2 (~$1,500) · pay the deposit to start'
    lead =
      lang === 'fr'
        ? `Marc a accepté ton projet en Tier 2${priceLine ? ` (≈ ${priceLine})` : ''}.`
        : `Marc accepted your project at Tier 2${priceLine ? ` (≈ ${priceLine})` : ''}.`
    body =
      lang === 'fr'
        ? `${halfLine} Le bouton « Payer le dépôt » est maintenant actif sur la page de ta session.`
        : `${halfLine} The "Pay the deposit" button is now live on your session page.`
    cta = lang === 'fr' ? 'Ouvrir ma session' : 'Open my session'
  } else if (tier === 3) {
    if (isLateQuote) {
      // Acceptance happened earlier; this email is specifically the
      // quote landing. Subject + lead reflect that to avoid sounding like
      // a second acceptance.
      subject =
        lang === 'fr'
          ? `Devis Tier 3 prêt${priceLine ? ` (${priceLine})` : ''} · paie pour démarrer`
          : `Tier 3 quote ready${priceLine ? ` (${priceLine})` : ''} · pay to start`
      lead =
        lang === 'fr'
          ? priceLine
            ? `Marc a fixé le montant de ton projet Tier 3 à ${priceLine}.`
            : 'Marc a fixé le montant de ton projet Tier 3.'
          : priceLine
            ? `Marc set the amount for your Tier 3 project to ${priceLine}.`
            : 'Marc set the amount for your Tier 3 project.'
    } else {
      subject =
        lang === 'fr'
          ? `Marc accepte — devis Tier 3${priceLine ? ` (${priceLine})` : ''}`
          : `Marc accepted — Tier 3 quote${priceLine ? ` (${priceLine})` : ''}`
      lead =
        lang === 'fr'
          ? priceLine
            ? `Marc a accepté ton projet en Tier 3 et a fixé le montant à ${priceLine}.`
            : 'Marc a accepté ton projet en Tier 3.'
          : priceLine
            ? `Marc accepted your project at Tier 3 and set the amount to ${priceLine}.`
            : 'Marc accepted your project at Tier 3.'
    }
    body =
      lang === 'fr'
        ? 'Le bouton « Payer (sur devis) » est actif sur la page de ta session. Si tu as des questions, écris dans le fil — Marc répond là.'
        : 'The "Pay (quoted)" button is live on your session page. If you have questions, drop them in the thread — Marc replies there.'
    cta = lang === 'fr' ? 'Ouvrir ma session' : 'Open my session'
  } else {
    // Tier 1
    subject =
      lang === 'fr'
        ? `Marc accepte — Tier 1${priceLine ? ` (${priceLine})` : ''} · paie pour démarrer`
        : `Marc accepted — Tier 1${priceLine ? ` (${priceLine})` : ''} · pay to start`
    lead =
      lang === 'fr'
        ? `Marc a accepté ton projet en Tier 1${priceLine ? ` (${priceLine})` : ''}.`
        : `Marc accepted your project at Tier 1${priceLine ? ` (${priceLine})` : ''}.`
    body =
      lang === 'fr'
        ? 'Le bouton « Payer Tier 1 » est maintenant actif sur la page de ta session. Une fois le paiement reçu, je démarre.'
        : 'The "Pay Tier 1" button is now live on your session page. Once the payment lands, I start.'
    cta = lang === 'fr' ? 'Ouvrir ma session' : 'Open my session'
  }

  const html = `<!doctype html><html><body style="font-family:system-ui,sans-serif;max-width:480px;margin:auto;padding:24px;color:#1a1a1a">
<p><strong>${lead}</strong></p>
<p style="color:#444">${body}</p>
<p><a href="${sessionUrl}" style="display:inline-block;padding:10px 16px;background:#3d6e4e;color:#fff;text-decoration:none;border-radius:6px">${cta}</a></p>
<p style="color:#999;font-size:12px;word-break:break-all">${sessionUrl}</p>
</body></html>`
  const text = `${lead}\n\n${body}\n\n${cta}: ${sessionUrl}`
  return send(apiKey, { from: RESEND_FROM, to: visitorEmail, subject, html, text })
}

/** Format CAD cents per OQLF (FR) / standard locale (EN). Mirrors the
 *  client-side formatter in PaymentActions.tsx — duplicated here because
 *  Workers Intl.NumberFormat supports CAD currency formatting at runtime.
 *  Round-dollar amounts drop the cents portion so subjects/bodies read as
 *  "$300" / "300 $" rather than "$300.00" / "300,00 $". */
function formatCadCents(cents: number, lang: 'fr' | 'en'): string {
  const isRound = cents % 100 === 0
  return new Intl.NumberFormat(lang === 'fr' ? 'fr-CA' : 'en-CA', {
    style: 'currency',
    currency: 'CAD',
    currencyDisplay: lang === 'fr' ? 'symbol' : 'narrowSymbol',
    minimumFractionDigits: isRound ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(cents / 100)
}

/**
 * A new vouch was just submitted. Marc gets a heads-up so he can
 * moderate (approve / reject / edit) in /admin/vouches. Visitor doesn't
 * get an email back — the UI tells them "Marc relit avant que ça
 * paraisse." Matches the async-no-calls voice.
 */
export async function sendNewVouchNotification(
  apiKey: string,
  marcEmail: string,
  vouchId: string,
  authorName: string,
  authorEmail: string,
  relationship: string,
  bodyPreview: string,
  origin: string,
): Promise<boolean> {
  const subject = 'A new vouch is awaiting moderation'
  // No dedicated /admin/vouches page yet — link to the hub so Marc lands
  // somewhere live. Replace with /admin/vouches once that surface ships.
  const url = `${origin}/admin`
  const preview = bodyPreview.length > 240 ? bodyPreview.slice(0, 237) + '…' : bodyPreview
  const html = `<!doctype html><html><body style="font-family:system-ui,sans-serif;max-width:520px;margin:auto;padding:24px;color:#1a1a1a">
<p><strong>${escapeHtml(authorName)}</strong> <span style="color:#7a7568">(${escapeHtml(relationship)})</span> just submitted a vouch.</p>
<blockquote style="margin:14px 0;padding:10px 14px;background:#fbf7ec;border-left:3px solid #3d6e4e;color:#3f3c34;font-size:14px;line-height:1.5;">${escapeHtml(preview)}</blockquote>
<p style="color:#444;font-size:13px">From <code>${escapeHtml(authorEmail)}</code> · id <code>${escapeHtml(vouchId)}</code></p>
<p><a href="${url}" style="display:inline-block;padding:10px 16px;background:#3d6e4e;color:#fff;text-decoration:none;border-radius:6px">Moderate</a></p>
</body></html>`
  const text = `${authorName} (${relationship}) submitted a vouch:\n\n${preview}\n\nFrom ${authorEmail} · id ${vouchId}\n\n${url}`
  return send(apiKey, { from: RESEND_FROM, to: marcEmail, subject, html, text })
}

/**
 * The visitor just explicitly confirmed "Tout à toi" / "All yours" — they
 * opted OUT of Custodian. Marc gets a heads-up so he can plan the handoff
 * accordingly. Visitor doesn't get an email back; the UI confirms it
 * on /session/:id.
 */
export async function sendAllYoursAckNotification(
  apiKey: string,
  marcEmail: string,
  visitorEmail: string,
  sessionId: string,
  origin: string,
): Promise<boolean> {
  const subject = "Visitor confirmed 'All yours' (opted out of Custodian)"
  const url = `${origin}/admin/inbox/${sessionId}`
  const html = `<!doctype html><html><body style="font-family:system-ui,sans-serif;max-width:480px;margin:auto;padding:24px;color:#1a1a1a">
<p><strong>${escapeHtml(visitorEmail)}</strong> ticked the skills checklist and confirmed Tout à toi.</p>
<p style="color:#444">They take ownership of the ops stack at handoff. Plan the asset transfer accordingly.</p>
<p><a href="${url}">Open in admin</a></p>
</body></html>`
  const text = `${visitorEmail} confirmed Tout à toi (opted out of Custodian).\n\n${url}`
  return send(apiKey, { from: RESEND_FROM, to: marcEmail, subject, html, text })
}

function statusLabel(status: string, lang: 'fr' | 'en'): string {
  const FR: Record<string, string> = {
    draft: 'brouillon',
    triage: 'en triage',
    active: 'active',
    shipped: 'livrée',
    rejected: 'refusée',
  }
  const EN: Record<string, string> = {
    draft: 'draft',
    triage: 'in triage',
    active: 'active',
    shipped: 'shipped',
    rejected: 'rejected',
  }
  return (lang === 'fr' ? FR[status] : EN[status]) ?? status
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
