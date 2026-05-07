// Resend wrapper. Free tier: 100/day, 3000/mo, sender onboarding@resend.dev
// works without DNS setup. Swap to a verified custom domain before first cold
// post. Errors here are logged and swallowed so a transient Resend outage
// doesn't 500 user-facing endpoints — the magic link still gets stored.

const RESEND_FROM = 'Marc Portal <onboarding@resend.dev>'
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
  const subject = `New message from ${visitorEmail}`
  const url = `${origin}/admin/inbox/${sessionId}`
  const html = `<!doctype html><html><body style="font-family:system-ui,sans-serif;max-width:480px;margin:auto;padding:24px;color:#1a1a1a">
<p><strong>${visitorEmail}</strong> posted in their session:</p>
<blockquote style="border-left:3px solid #d97706;padding:8px 12px;color:#444;background:#faf7f2">${escapeHtml(preview).slice(0, 400)}</blockquote>
<p><a href="${url}">Open in admin inbox</a></p>
</body></html>`
  const text = `${visitorEmail} posted: ${preview.slice(0, 400)}\n\n${url}`
  return send(apiKey, { from: RESEND_FROM, to: marcEmail, subject, html, text })
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
