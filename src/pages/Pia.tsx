import { useEffect } from 'react'
import type { Lang } from '../i18n'
import { Header } from '../components/Header'
import { Footer } from '../components/Footer'

/**
 * Public-facing Privacy Impact Assessments (PIAs) — Loi 25 art. 3.3.
 *
 * Two PIAs are maintained for marc-portal:
 *   - Sentry  (error monitoring; cross-border to US)
 *   - Stripe  (payments; Canadian processing entity)
 *
 * Privacy.tsx §6 (Sentry) and §11 (Stripe) link to anchors on this page.
 * The canonical markdown sources live at docs/loi-25-pia.md and
 * docs/loi-25-pia-stripe.md; this page mirrors them faithfully so the
 * "available on request" language in the privacy policy becomes
 * "available now, at /pia." Annual review is scheduled per each PIA.
 */

const COPY = {
  fr: {
    pageTitle: 'EFVP — Marc',
    title: 'Évaluations des facteurs relatifs à la vie privée',
    intro:
      'Loi 25 (art. 3.3) exige une évaluation des facteurs relatifs à la vie privée (EFVP) avant l’adoption de tout traitement de renseignements personnels par un tiers. Voici, en clair, les deux EFVP actuellement en vigueur pour ce portail. Le texte technique est en anglais — il est destiné à être lu par un juriste, un client en diligence raisonnable, ou la Commission d’accès à l’information sur demande.',
    asOf: 'Dernière mise à jour : 2026-05-16.',
    indexLabel: 'Sur cette page',
    indexSentry: 'EFVP Sentry (monitoring d’erreurs)',
    indexStripe: 'EFVP Stripe (paiements)',
  },
  en: {
    pageTitle: 'PIAs — Marc',
    title: 'Privacy Impact Assessments',
    intro:
      'Quebec Bill 25 (art. 3.3) requires a Privacy Impact Assessment (PIA) before adopting any new processing of personal information by a third party. The two currently in force for this portal are reproduced below in full. Intended audience: legal counsel, a client doing due diligence, or the Commission d’accès à l’information on request.',
    asOf: 'Last updated: 2026-05-16.',
    indexLabel: 'On this page',
    indexSentry: 'Sentry PIA (error monitoring)',
    indexStripe: 'Stripe PIA (payments)',
  },
} as const

export function Pia({ lang }: { lang: Lang }) {
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

            <nav aria-label={t.indexLabel} className="privacy__toc">
              <p className="mono">{t.indexLabel}</p>
              <ul>
                <li>
                  <a href="#sentry">{t.indexSentry}</a>
                </li>
                <li>
                  <a href="#stripe">{t.indexStripe}</a>
                </li>
              </ul>
            </nav>

            <PiaSentry />
            <PiaStripe />
          </div>
        </article>
      </main>
      <Footer lang={lang} />
    </div>
  )
}

function PiaSentry() {
  return (
    <section id="sentry" className="privacy__section">
      <h2>Privacy Impact Assessment — Sentry integration</h2>
      <blockquote>
        <strong>Statute:</strong> Loi 25 (Quebec), art. 3.3 (PIA requirement for new projects
        involving personal info) and art. 17 (cross-border transfers).
        <br />
        <strong>Scope:</strong> Adoption of Sentry (sentry.io) as the error-monitoring service for
        the marc-portal SPA + Pages Functions.
        <br />
        <strong>Status:</strong> Internal record. Not filed with the Commission d’accès à
        l’information (CAI) unless requested. Maintained at{' '}
        <code>docs/loi-25-pia.md</code>.
      </blockquote>

      <h3>1. Identification</h3>
      <table className="pia-table">
        <tbody>
          <tr>
            <th>Project</th>
            <td>Sentry error-monitoring integration for marc-portal</td>
          </tr>
          <tr>
            <th>Date of PIA</th>
            <td>2026-05-15</td>
          </tr>
          <tr>
            <th>Person responsible (DPO de fait)</th>
            <td>Marc Jeanson — marc@marcportal.com</td>
          </tr>
          <tr>
            <th>Operational scope</th>
            <td>
              marc-portal.pages.dev and any custom domain attached to the same Cloudflare Pages
              project.
            </td>
          </tr>
          <tr>
            <th>Decision</th>
            <td>
              Proceed. Residual risk assessed as <strong>low</strong> after the mitigations in §6
              are in place.
            </td>
          </tr>
        </tbody>
      </table>

      <h3>2. Description of the processing</h3>
      <p>
        The marc-portal frontend (<code>@sentry/react</code>) and Pages Functions (a hand-rolled
        envelope poster in <code>functions/_lib/sentry.ts</code>) emit an error event to Sentry
        whenever code throws an unhandled exception. The event is transmitted over HTTPS to
        Sentry’s US-region ingest endpoint (
        <code>o4510241708244992.ingest.us.sentry.io</code>).
      </p>

      <h3>3. Data inventory</h3>
      <h4>3.1 What is transmitted to Sentry</h4>
      <table className="pia-table">
        <thead>
          <tr>
            <th>Field</th>
            <th>Source</th>
            <th>Personal info?</th>
            <th>Why</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Error message, type</td>
            <td>
              thrown <code>Error.message</code>, <code>.name</code>
            </td>
            <td>Generally no</td>
            <td>Required to identify the bug</td>
          </tr>
          <tr>
            <td>Stack trace</td>
            <td>
              thrown <code>Error.stack</code>
            </td>
            <td>No (function names, file paths)</td>
            <td>Required to locate the bug</td>
          </tr>
          <tr>
            <td>Browser, OS, version</td>
            <td>
              <code>User-Agent</code> parsing
            </td>
            <td>No (technical metadata)</td>
            <td>Reproduce environment-specific bugs</td>
          </tr>
          <tr>
            <td>Page path</td>
            <td>
              <code>window.location.pathname</code> (query string stripped)
            </td>
            <td>No (path only)</td>
            <td>“Where did this happen”</td>
          </tr>
          <tr>
            <td>Environment tag</td>
            <td>runtime inference</td>
            <td>No</td>
            <td>Filter prod vs preview</td>
          </tr>
          <tr>
            <td>Breadcrumbs</td>
            <td>Sentry SDK auto-capture (query strings stripped)</td>
            <td>No</td>
            <td>Reproduce user path leading to error</td>
          </tr>
          <tr>
            <td>
              User identity (<code>user.email</code>)
            </td>
            <td>only when visitor is the operator (Marc)</td>
            <td>The operator’s own email</td>
            <td>Help Marc filter his own QA errors</td>
          </tr>
        </tbody>
      </table>

      <h4>3.2 What is explicitly excluded</h4>
      <ul>
        <li>
          <strong>Visitor’s email</strong> — not sent for anyone other than the operator.
        </li>
        <li>
          <strong>URL query strings</strong> — stripped before send. Magic-link tokens, share
          capability IDs, <code>?lang=</code> would all otherwise ride along.
        </li>
        <li>
          <strong>Authentication headers</strong> — <code>Cookie</code>,{' '}
          <code>Authorization</code>, <code>X-CSRF-Token</code> are deleted in{' '}
          <code>beforeSend</code> (client) and in <code>requestSummary</code> (server).
        </li>
        <li>
          <strong>IP address</strong> — <code>sendDefaultPii: false</code> in the SDK +{' '}
          <code>user.ip_address</code> nullified defensively. Sentry’s server-side “Prevent
          Storing of IP Addresses” toggle is enabled.
        </li>
        <li>
          <strong>Request bodies</strong> — neither the SDK nor our envelope poster serialize
          request bodies.
        </li>
        <li>
          <strong>Session replays</strong> — <code>replaysSessionSampleRate: 0</code>,{' '}
          <code>replaysOnErrorSampleRate: 0</code>.
        </li>
        <li>
          <strong>Performance traces</strong> — <code>tracesSampleRate: 0</code>.
        </li>
      </ul>

      <h3>4. Purposes (Loi 25 art. 8)</h3>
      <p>
        Diagnose and fix software defects that affect Quebec visitors. Without error monitoring,
        defects surface only when a visitor explicitly reports them — many won’t, and the visitor
        suffers a broken experience in silence. Error monitoring is therefore strictly necessary
        for the prestation of the service at the quality level the practice commits to.
      </p>

      <h3>5. Cross-border transfer assessment (Loi 25 art. 17)</h3>
      <table className="pia-table">
        <tbody>
          <tr>
            <th>Recipient</th>
            <td>Functional Software Inc., dba Sentry. 132 Hawthorne St, San Francisco, CA 94107, USA.</td>
          </tr>
          <tr>
            <th>Jurisdiction</th>
            <td>
              United States. No federal omnibus privacy law equivalent to Loi 25 or GDPR;
              sector-specific. Sentry voluntarily complies with GDPR, CCPA, ISO 27001, SOC 2 Type II.
            </td>
          </tr>
          <tr>
            <th>Equivalent protection</th>
            <td>
              Achieved contractually via Sentry’s Data Processing Agreement (DPA), Standard
              Contractual Clauses (SCCs), and the technical mitigations in §6. Combination
              delivers protection materially equivalent to Loi 25 for the limited dataset.
            </td>
          </tr>
          <tr>
            <th>Volume</th>
            <td>Low. One operator, ~ one visitor at a time. Expected event rate: &lt; 100/month.</td>
          </tr>
          <tr>
            <th>Sensitivity</th>
            <td>
              Telemetry only. No special categories of personal info (CCQ art. 12 — health,
              ethnic origin, etc.) ever touch the error pipeline.
            </td>
          </tr>
          <tr>
            <th>Necessity</th>
            <td>Operationally required to deliver the service quality committed in /confidentialite.</td>
          </tr>
        </tbody>
      </table>
      <p>
        <strong>Conclusion:</strong> the transfer is proportionate to the operational benefit.
      </p>

      <h3>6. Mitigations</h3>
      <h4>6.1 Minimization (in code)</h4>
      <ul>
        <li>
          Hardcoded DSN in <code>src/lib/sentry.ts</code> and{' '}
          <code>functions/_lib/sentry.ts</code> collapses the env-var attack surface.
        </li>
        <li>
          <code>beforeSend</code> strips Cookie, Authorization, X-CSRF-Token, URL query strings
          (both event and breadcrumbs), and nullifies <code>user.ip_address</code>.
        </li>
        <li>
          <code>setSentryUser</code> is admin-gated: <code>Sentry.setUser(null)</code> for every
          non-operator visitor.
        </li>
        <li>
          Server-side <code>requestSummary</code> emits <code>${'{origin}'}${'{pathname}'}</code>{' '}
          only.
        </li>
      </ul>

      <h4>6.2 Residual risk: share-capability IDs in URL paths</h4>
      <p>
        Routes like <code>/share/:id</code> carry a 72-bit capability token in the URL path.
        Loss of the token to Sentry is equivalent to loss of the share URL itself — which the
        visitor was free to send to anyone. <strong>Residual risk: negligible.</strong>
      </p>

      <h4>6.3 Sentry account / DPA (operational)</h4>
      <table className="pia-table">
        <thead>
          <tr>
            <th>Action</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Sign Sentry’s Data Processing Agreement (sentry.io/legal/dpa/)</td>
            <td>✅ 2026-05-15</td>
          </tr>
          <tr>
            <td>Project retention = 30 days</td>
            <td>✅ 2026-05-15 (free/Developer plan default)</td>
          </tr>
          <tr>
            <td>Enable “Prevent Storing of IP Addresses”</td>
            <td>✅ 2026-05-15</td>
          </tr>
          <tr>
            <td>Require Data Scrubber + Default Scrubbers</td>
            <td>✅ 2026-05-15</td>
          </tr>
          <tr>
            <td>Enhanced Privacy toggle</td>
            <td>✅ 2026-05-15</td>
          </tr>
          <tr>
            <td>Global Sensitive Fields supplement</td>
            <td>✅ 2026-05-15</td>
          </tr>
          <tr>
            <td>
              Document this PIA exists in <code>RUNBOOK.md</code>
            </td>
            <td>✅</td>
          </tr>
        </tbody>
      </table>

      <h4>6.4 Visitor-facing notice (Loi 25 art. 8)</h4>
      <p>
        <code>/confidentialite</code> (FR) and <code>/en/privacy</code> (EN) sections 2, 5, and 6
        explicitly disclose: existence of Sentry, what’s collected, where it goes, retention, and
        opt-out path. Section 7 explains the right-of-access posture.
      </p>

      <h3>7. Rights handling (art. 27 / 28 / 28.1)</h3>
      <ul>
        <li>
          <strong>Right of access:</strong> Sentry events do not carry a visitor’s identity. When
          a visitor asks “what do you have on me?”, the canonical response w.r.t. Sentry is “no
          events about you specifically; Sentry events are anonymous.”
        </li>
        <li>
          <strong>Right of rectification:</strong> not applicable to error events.
        </li>
        <li>
          <strong>Right of erasure:</strong> the 30-day retention auto-purges.
        </li>
      </ul>

      <h3>8. Breach posture (art. 3.5 + 3.6)</h3>
      <p>
        Sentry has its own incident-response and breach-notification obligations under their DPA.
        In the event of a breach affecting marc-portal events: identify exposed events; per §3.1,
        no PII for non-operator visitors → for visitors, no notification to CAI is required
        (no serious harm risk); for operator-tagged events, notify Marc (himself).
      </p>

      <h3>9. Review schedule</h3>
      <p>
        Reviewed annually on the anniversary of integration (2026-05-15), whenever Sentry’s
        configuration changes, or whenever the marc-portal data model adds a class of personal
        info that could surface in stack traces. <strong>Next scheduled review: 2027-05-15.</strong>
      </p>
    </section>
  )
}

function PiaStripe() {
  return (
    <section id="stripe" className="privacy__section">
      <h2>Privacy Impact Assessment — Stripe integration</h2>
      <blockquote>
        <strong>Statute:</strong> Loi 25 (Quebec), art. 3.3 (PIA requirement for new projects
        involving personal info) and art. 17 (cross-border transfers).
        <br />
        <strong>Scope:</strong> Adoption of Stripe as the payments processor for marc-portal
        (Tier 1/2/3 one-time payments + custodian-mode subscriptions).
        <br />
        <strong>Status:</strong> Internal record. Not filed with the Commission d’accès à
        l’information (CAI) unless requested. Maintained at{' '}
        <code>docs/loi-25-pia-stripe.md</code>.
      </blockquote>

      <h3>1. Identification</h3>
      <table className="pia-table">
        <tbody>
          <tr>
            <th>Project</th>
            <td>Stripe Checkout + Subscriptions for marc-portal</td>
          </tr>
          <tr>
            <th>Date of PIA</th>
            <td>2026-05-16</td>
          </tr>
          <tr>
            <th>Person responsible (DPO de fait)</th>
            <td>Marc Jeanson — marc@marcportal.com</td>
          </tr>
          <tr>
            <th>Operational scope</th>
            <td>
              marc-portal.pages.dev and any custom domain attached to the same Cloudflare Pages
              project.
            </td>
          </tr>
          <tr>
            <th>Decision</th>
            <td>
              Proceed. Residual risk assessed as <strong>low</strong> after the mitigations in §6
              are in place.
            </td>
          </tr>
        </tbody>
      </table>

      <h3>2. Description of the processing</h3>
      <p>
        When a visitor clicks <strong>Pay</strong> on <code>/me</code> for an accepted session,
        the marc-portal server creates a Stripe Checkout session via the Stripe REST API and
        redirects the browser to Stripe’s hosted payment page. The visitor enters their card
        details directly into Stripe’s page — <strong>card data never transits or is stored by
        marc-portal</strong>. After payment, Stripe sends a signed webhook to{' '}
        <code>/api/payments/webhook</code>, which updates the local D1 record and emits a
        confirmation. For the custodian-mode subscription, the same flow runs in{' '}
        <code>mode: subscription</code>, and renewals are handled entirely by Stripe.
      </p>

      <h3>3. Data inventory</h3>
      <h4>3.1 What we transmit to Stripe</h4>
      <table className="pia-table">
        <thead>
          <tr>
            <th>Field</th>
            <th>Source</th>
            <th>Personal info?</th>
            <th>Why</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <code>customer_email</code>
            </td>
            <td>session row</td>
            <td>
              <strong>Yes</strong> (email)
            </td>
            <td>Stripe sends receipt; matches visitor’s account</td>
          </tr>
          <tr>
            <td>
              <code>client_reference_id</code>
            </td>
            <td>
              our <code>pay_*</code> id
            </td>
            <td>No (opaque)</td>
            <td>Webhook idempotency join</td>
          </tr>
          <tr>
            <td>
              <code>metadata.payment_id</code>
            </td>
            <td>
              our <code>pay_*</code> id
            </td>
            <td>No (opaque)</td>
            <td>Same; carried through</td>
          </tr>
          <tr>
            <td>
              <code>metadata.session_id</code>
            </td>
            <td>our session id</td>
            <td>No (opaque)</td>
            <td>Locate the session on webhook</td>
          </tr>
          <tr>
            <td>
              <code>metadata.kind</code>
            </td>
            <td>
              <code>tier1</code> / <code>tier2-deposit</code> / …
            </td>
            <td>No (categorical)</td>
            <td>Tax/accounting categorization</td>
          </tr>
          <tr>
            <td>Line-item label</td>
            <td>constant + optional showcase title</td>
            <td>No (project name only)</td>
            <td>Receipt clarity</td>
          </tr>
          <tr>
            <td>
              <code>amount</code> or <code>price_id</code>
            </td>
            <td>static (TIER_AMOUNTS / env)</td>
            <td>No</td>
            <td>Amount to charge</td>
          </tr>
        </tbody>
      </table>

      <h4>3.2 What we collect via Stripe (but never store ourselves)</h4>
      <p>
        Stripe collects card data, billing address (if Stripe Tax is enabled — <strong>not
        enabled</strong> in this project), and any tax-ID the visitor enters in the
        Stripe-hosted Customer Portal. None of these reach the marc-portal server. They live in
        Stripe’s vault under their PCI-DSS Level 1 controls.
      </p>

      <h4>3.3 What we receive from Stripe (webhooks)</h4>
      <table className="pia-table">
        <thead>
          <tr>
            <th>Field</th>
            <th>Stored where</th>
            <th>Why</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <code>id</code> (Stripe object id)
            </td>
            <td>
              <code>payments.stripe_*_id</code> columns
            </td>
            <td>Idempotency + audit trail</td>
          </tr>
          <tr>
            <td>
              <code>amount_paid</code>, <code>amount_total</code>
            </td>
            <td>
              <code>payments.amount_cents</code> (echoed)
            </td>
            <td>Display, accounting</td>
          </tr>
          <tr>
            <td>
              <code>customer</code> (cus_…)
            </td>
            <td>
              <code>payments.stripe_customer_id</code>
            </td>
            <td>Open Customer Portal later</td>
          </tr>
          <tr>
            <td>
              <code>subscription</code> (sub_…)
            </td>
            <td>
              <code>payments.stripe_subscription_id</code> +{' '}
              <code>sessions.custodian_subscription_id</code>
            </td>
            <td>Map renewals back to session</td>
          </tr>
          <tr>
            <td>
              Event type, <code>paid_at</code>
            </td>
            <td>
              <code>payments.status</code>, <code>paid_at</code>
            </td>
            <td>Status of the payment</td>
          </tr>
        </tbody>
      </table>
      <p>
        Visitor’s email is <strong>not</strong> copied from the webhook into our DB — we already
        have it on the session row. Card details (last4, brand, exp) are present in Stripe’s
        webhook payloads but we explicitly do not persist them (PCI scope avoidance).
      </p>

      <h4>3.4 What is explicitly excluded</h4>
      <ul>
        <li>
          <strong>No card data.</strong> Stripe-hosted Checkout means we never see PAN/CVC/exp;
          we never become PCI-DSS in-scope beyond SAQ A.
        </li>
        <li>
          <strong>No billing address persisted on our side.</strong>
        </li>
        <li>
          <strong>No client identity in our Sentry events.</strong> The webhook handler does not
          re-throw (it logs + 200s), so its body — which contains visitor email from Stripe — is
          never captured by Sentry.
        </li>
      </ul>

      <h3>4. Lawful basis (Loi 25 art. 12, 12.1)</h3>
      <p>
        The processing is <strong>necessary for the performance of the contract</strong> the
        visitor entered into when accepting a tier price. Payment is the consideration; without
        it the engagement cannot complete. Consent is implicit in the act of clicking “Pay”;
        explicit consent for the Stripe transfer is given via the privacy notice on{' '}
        <code>/me</code>.
      </p>

      <h3>5. Cross-border transfer analysis (Loi 25 art. 17)</h3>
      <p>
        <strong>Material distinction from Sentry:</strong> Stripe operates a Canadian processing
        entity, <strong>Stripe Payments Canada Ltd.</strong> (incorporated in Ontario; CRA
        registered). Per Stripe’s privacy policy and Master Services Agreement, payments
        originating from Canadian customers are processed by Stripe Payments Canada Ltd. This
        means:
      </p>
      <ul>
        <li>
          The processing <strong>is not a cross-border transfer</strong> for purposes of Loi 25
          art. 17 (which governs transfers <em>outside</em> Quebec/Canada).
        </li>
        <li>
          Card networks (Visa / Mastercard / Amex) still route data internationally as a
          function of the global payment system — but marc-portal is not the entity making that
          transfer; the bank is.
        </li>
        <li>
          Stripe’s standard processing infrastructure is global; we rely on Stripe’s
          adequate-protection commitments under their privacy policy and DPA.
        </li>
      </ul>
      <p>
        <strong>Conclusion:</strong> Loi 25 art. 17 obligations are met by virtue of using the
        Canadian entity.
      </p>

      <h3>6. Mitigations</h3>
      <h4>6.1 Code-level minimization</h4>
      <ul>
        <li>
          <strong>Stripe-hosted Checkout</strong> chosen over Stripe Elements: no card data ever
          crosses our origin. PCI scope reduced to SAQ A.
        </li>
        <li>
          <strong>
            <code>customer_email</code> is the only PII
          </strong>{' '}
          sent on Checkout creation. Visitor’s name, address, phone are not transmitted.
        </li>
        <li>
          <strong>Stripe Tax is NOT enabled.</strong> Once revenue crosses the $30k QC
          small-supplier threshold and registration becomes mandatory, this PIA must be
          re-reviewed.
        </li>
        <li>
          <strong>Webhook handler returns 200 + logs on failure</strong> — does not re-throw, so
          Sentry never receives a Stripe webhook body.
        </li>
        <li>
          <strong>Customer Portal is gated</strong> by visitor ownership of the session.
        </li>
      </ul>

      <h4>6.2 Residual risk: receipt emails sent by Stripe</h4>
      <p>
        Stripe emails a receipt to <code>customer_email</code> on every successful charge. This
        email is sent by Stripe directly (not us) to the visitor (not a third party). It
        contains the line-item label and the amount. <strong>Residual risk: negligible.</strong>
      </p>

      <h4>6.3 Stripe account / DPA (operational)</h4>
      <table className="pia-table">
        <thead>
          <tr>
            <th>Action</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Confirm Stripe Payments Canada Ltd. as processing entity (account country = Canada)</td>
            <td>⬜ confirm at activation</td>
          </tr>
          <tr>
            <td>Sign Stripe’s Services Agreement + DPA (click-through at signup)</td>
            <td>⬜ done at activation</td>
          </tr>
          <tr>
            <td>Disable “Email me when test mode events happen” once live</td>
            <td>⬜</td>
          </tr>
          <tr>
            <td>Set webhook endpoint signing secret on the live endpoint</td>
            <td>⬜</td>
          </tr>
          <tr>
            <td>
              Confirm <code>Stripe-Version: 2024-11-20.acacia</code> pin matches dashboard
              default OR update code
            </td>
            <td>⬜</td>
          </tr>
          <tr>
            <td>Enable restricted-key rotation policy (annual sk_live_* rotation)</td>
            <td>⬜</td>
          </tr>
          <tr>
            <td>
              Document this PIA exists in <code>RUNBOOK.md</code>
            </td>
            <td>✅</td>
          </tr>
        </tbody>
      </table>

      <h4>6.4 Refund / reversal handling</h4>
      <p>
        If a visitor requests a refund, Marc issues it from the Stripe Dashboard. The{' '}
        <code>charge.refunded</code> webhook updates <code>payments.status = &apos;refunded&apos;</code>{' '}
        on our side. Refund timing and amount are visible to the visitor in their Stripe receipt
        + the Customer Portal.
      </p>

      <h4>6.5 Visitor-facing notice (Loi 25 art. 8)</h4>
      <p>
        <code>/confidentialite</code> (FR) and <code>/en/privacy</code> (EN) §11 disclose:
        existence of Stripe Payments Canada Ltd., what is transmitted, the Canadian-processing
        posture, retention (per Stripe policy), and the rights-of-access path (via Customer
        Portal or written request to Marc).
      </p>

      <h3>7. Rights handling (art. 27 / 28 / 28.1)</h3>
      <ul>
        <li>
          <strong>Right of access:</strong> Stripe Customer Portal surfaces invoice history,
          card history, payment method. For a full export, Marc retrieves from the Stripe
          Dashboard on written request and delivers within 30 days.
        </li>
        <li>
          <strong>Right of rectification:</strong> card on file is changed in the Customer
          Portal. Billing address ditto. Receipts are immutable by design; a corrected receipt
          is issued as a credit note.
        </li>
        <li>
          <strong>Right of erasure:</strong> Stripe retains transaction records for{' '}
          <strong>7 years</strong> under FINTRAC + Income Tax Act obligations; we cannot delete
          them on demand. We can anonymize the customer email on Stripe’s side, delete the
          local <code>payments</code> rows that link Stripe IDs to a marc-portal session, and
          decline to delete Stripe-side immutable financial records citing the legal-obligation
          exception in Loi 25 art. 28.1.
        </li>
      </ul>

      <h3>8. Breach posture (art. 3.5 + 3.6)</h3>
      <p>
        Stripe has its own incident-response and breach-notification obligations under their
        DPA. In the event of a breach affecting marc-portal events: read Stripe’s incident
        report and identify the time window + affected accounts; for any affected visitor,
        notify within 72h by email (per Loi 25 art. 3.5 if the breach poses a risk of serious
        harm) and notify the CAI within the same 72h window (art. 3.6); log the incident in{' '}
        <code>RUNBOOK.md</code>.
      </p>

      <h3>9. Review schedule</h3>
      <p>
        Reviewed annually on the anniversary of integration (2026-05-16), whenever Stripe
        products change (e.g. enabling Stripe Tax, Stripe Connect, Issuing, Identity), whenever
        a Canadian processing-entity change is announced by Stripe, or whenever the marc-portal
        payment surface adds new data fields (currently: <code>customer_email</code> only).{' '}
        <strong>Next scheduled review: 2027-05-16.</strong>
      </p>
    </section>
  )
}
