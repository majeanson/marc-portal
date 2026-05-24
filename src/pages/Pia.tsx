import { useEffect } from 'react'
import type { Lang } from '../i18n'
import { Header } from '../components/Header'
import { Footer } from '../components/Footer'
import { FeatureContinue } from '../components/FeatureContinue'
import { FeatureFolioLink } from '../components/FeatureFolioLink'
import { PAGE_FEATURE } from '../lib/features'
import { PAGE_FOLIOS } from '../lib/folios'

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
      'Loi 25 (art. 3.3) exige une évaluation des facteurs relatifs à la vie privée (EFVP) avant l’adoption de tout traitement de renseignements personnels par un tiers. Voici, en clair, les deux EFVP actuellement en vigueur pour ce portail. Audience visée : un juriste, un client en diligence raisonnable, ou la Commission d’accès à l’information sur demande.',
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
            <FeatureFolioLink feature={PAGE_FEATURE['page.pia']} lang={lang} withDot>
              № {PAGE_FOLIOS.pia}
            </FeatureFolioLink>
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

            <PiaSentry lang={lang} />
            <PiaStripe lang={lang} />
          </div>
        </article>
      </main>
      <FeatureContinue page="page.pia" lang={lang} />
      <Footer lang={lang} />
    </div>
  )
}

// PIA bodies are split per language. Legal/technical prose with this many
// tables, blockquotes, code spans and embedded markup is unreadable when
// folded into a COPY object — keeping each language as its own JSX function
// lets reviewers (a juriste, a client doing due diligence) read the prose
// straight, and the dispatcher below picks the right one off `lang`.
function PiaSentry({ lang }: { lang: Lang }) {
  return lang === 'fr' ? <PiaSentryFr /> : <PiaSentryEn />
}

function PiaStripe({ lang }: { lang: Lang }) {
  return lang === 'fr' ? <PiaStripeFr /> : <PiaStripeEn />
}

function PiaSentryEn() {
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
        l’information (CAI) unless requested. Maintained at <code>docs/loi-25-pia.md</code>.
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
        whenever code throws an unhandled exception. The event is transmitted over HTTPS to Sentry’s
        US-region ingest endpoint (<code>o4510241708244992.ingest.us.sentry.io</code>).
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
          <strong>Authentication headers</strong> — <code>Cookie</code>, <code>Authorization</code>,{' '}
          <code>X-CSRF-Token</code> are deleted in <code>beforeSend</code> (client) and in{' '}
          <code>requestSummary</code> (server).
        </li>
        <li>
          <strong>IP address</strong> — <code>sendDefaultPii: false</code> in the SDK +{' '}
          <code>user.ip_address</code> nullified defensively. Sentry’s server-side “Prevent Storing
          of IP Addresses” toggle is enabled.
        </li>
        <li>
          <strong>Request bodies</strong> — neither the SDK nor the envelope poster serializes
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
        suffers a broken experience in silence. Error monitoring is therefore strictly necessary for
        the prestation of the service at the quality level the practice commits to.
      </p>

      <h3>5. Cross-border transfer assessment (Loi 25 art. 17)</h3>
      <table className="pia-table">
        <tbody>
          <tr>
            <th>Recipient</th>
            <td>
              Functional Software Inc., dba Sentry. 132 Hawthorne St, San Francisco, CA 94107, USA.
            </td>
          </tr>
          <tr>
            <th>Jurisdiction</th>
            <td>
              United States. No federal omnibus privacy law equivalent to Loi 25 or GDPR;
              sector-specific. Sentry voluntarily complies with GDPR, CCPA, ISO 27001, SOC 2 Type
              II.
            </td>
          </tr>
          <tr>
            <th>Equivalent protection</th>
            <td>
              Achieved contractually via Sentry’s Data Processing Agreement (DPA), Standard
              Contractual Clauses (SCCs), and the technical mitigations in §6. Combination delivers
              protection materially equivalent to Loi 25 for the limited dataset.
            </td>
          </tr>
          <tr>
            <th>Volume</th>
            <td>
              Low. One operator, ~ one visitor at a time. Expected event rate: &lt; 100/month.
            </td>
          </tr>
          <tr>
            <th>Sensitivity</th>
            <td>
              Telemetry only. No special categories of personal info (CCQ art. 12 — health, ethnic
              origin, etc.) ever touch the error pipeline.
            </td>
          </tr>
          <tr>
            <th>Necessity</th>
            <td>
              Operationally required to deliver the service quality committed in /confidentialite.
            </td>
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
          Hardcoded DSN in <code>src/lib/sentry.ts</code> and <code>functions/_lib/sentry.ts</code>{' '}
          collapses the env-var attack surface.
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
          Server-side <code>requestSummary</code> emits{' '}
          <code>
            ${'{origin}'}${'{pathname}'}
          </code>{' '}
          only.
        </li>
      </ul>

      <h4>6.2 Residual risk: share-capability IDs in URL paths</h4>
      <p>
        Routes like <code>/share/:id</code> carry a 72-bit capability token in the URL path. Loss of
        the token to Sentry is equivalent to loss of the share URL itself — which the visitor was
        free to send to anyone. <strong>Residual risk: negligible.</strong>
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
          <strong>Right of access:</strong> Sentry events do not carry a visitor’s identity. When a
          visitor asks “what do you have on me?”, the canonical response w.r.t. Sentry is “no events
          about you specifically; Sentry events are anonymous.”
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
        Sentry has its own incident-response and breach-notification obligations under their DPA. In
        the event of a breach affecting marc-portal events: identify exposed events; per §3.1, no
        PII for non-operator visitors → for visitors, no notification to CAI is required (no serious
        harm risk); for operator-tagged events, notify Marc (himself).
      </p>

      <h3>9. Review schedule</h3>
      <p>
        Reviewed annually on the anniversary of integration (2026-05-15), whenever Sentry’s
        configuration changes, or whenever the marc-portal data model adds a class of personal info
        that could surface in stack traces. <strong>Next scheduled review: 2027-05-15.</strong>
      </p>
    </section>
  )
}

function PiaStripeEn() {
  return (
    <section id="stripe" className="privacy__section">
      <h2>Privacy Impact Assessment — Stripe integration</h2>
      <blockquote>
        <strong>Statute:</strong> Loi 25 (Quebec), art. 3.3 (PIA requirement for new projects
        involving personal info) and art. 17 (cross-border transfers).
        <br />
        <strong>Scope:</strong> Adoption of Stripe as the payments processor for marc-portal (Tier
        1/2/3 one-time payments + custodian-mode subscriptions).
        <br />
        <strong>Status:</strong> Internal record. Not filed with the Commission d’accès à
        l’information (CAI) unless requested. Maintained at <code>docs/loi-25-pia-stripe.md</code>.
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
        When a visitor clicks <strong>Pay</strong> on <code>/me</code> for an accepted session, the
        marc-portal server creates a Stripe Checkout session via the Stripe REST API and redirects
        the browser to Stripe’s hosted payment page. The visitor enters their card details directly
        into Stripe’s page — <strong>card data never transits or is stored by marc-portal</strong>.
        After payment, Stripe sends a signed webhook to <code>/api/payments/webhook</code>, which
        updates the local D1 record and emits a confirmation. For the custodian-mode subscription,
        the same flow runs in <code>mode: subscription</code>, and renewals are handled entirely by
        Stripe.
      </p>

      <h3>3. Data inventory</h3>
      <h4>3.1 What the portal transmits to Stripe</h4>
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
              the portal <code>pay_*</code> id
            </td>
            <td>No (opaque)</td>
            <td>Webhook idempotency join</td>
          </tr>
          <tr>
            <td>
              <code>metadata.payment_id</code>
            </td>
            <td>
              the portal <code>pay_*</code> id
            </td>
            <td>No (opaque)</td>
            <td>Same; carried through</td>
          </tr>
          <tr>
            <td>
              <code>metadata.session_id</code>
            </td>
            <td>the portal session id</td>
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

      <h4>3.2 What the portal collects via Stripe (but never stores)</h4>
      <p>
        Stripe collects card data, billing address (if Stripe Tax is enabled —{' '}
        <strong>not enabled</strong> in this project), and any tax-ID the visitor enters in the
        Stripe-hosted Customer Portal. None of these reach the marc-portal server. They live in
        Stripe’s vault under their PCI-DSS Level 1 controls.
      </p>

      <h4>3.3 What the portal receives from Stripe (webhooks)</h4>
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
        Visitor’s email is <strong>not</strong> copied from the webhook into the portal DB — it
        already lives on the session row. Card details (last4, brand, exp) are present in Stripe’s
        webhook payloads but are explicitly not persisted (PCI scope avoidance).
      </p>

      <h4>3.4 What is explicitly excluded</h4>
      <ul>
        <li>
          <strong>No card data.</strong> Stripe-hosted Checkout means the portal never sees
          PAN/CVC/exp; PCI-DSS scope stays at SAQ A.
        </li>
        <li>
          <strong>No billing address persisted on the portal side.</strong>
        </li>
        <li>
          <strong>No client identity in Sentry events.</strong> The webhook handler does not
          re-throw (it logs + 200s), so its body — which contains visitor email from Stripe — is
          never captured by Sentry.
        </li>
      </ul>

      <h3>4. Lawful basis (Loi 25 art. 12, 12.1)</h3>
      <p>
        The processing is <strong>necessary for the performance of the contract</strong> the visitor
        entered into when accepting a tier price. Payment is the consideration; without it the
        engagement cannot complete. Consent is implicit in the act of clicking “Pay”; explicit
        consent for the Stripe transfer is given via the privacy notice on <code>/me</code>.
      </p>

      <h3>5. Cross-border transfer analysis (Loi 25 art. 17)</h3>
      <p>
        <strong>Material distinction from Sentry:</strong> Stripe operates a Canadian processing
        entity, <strong>Stripe Payments Canada Ltd.</strong> (incorporated in Ontario; CRA
        registered). Per Stripe’s privacy policy and Master Services Agreement, the primary
        processing entity for payments originating from Canadian customers is Stripe Payments Canada
        Ltd. This means:
      </p>
      <ul>
        <li>
          The direct transfer initiated by marc-portal lands at a Canadian Stripe entity, which{' '}
          <strong>reduces but does not eliminate</strong> the Loi 25 art. 17 surface (compared to
          sending data straight to a US-only processor like Sentry).
        </li>
        <li>
          Card networks (Visa / Mastercard / Amex) still route data internationally as a function of
          the global payment system — but marc-portal is not the entity making that transfer; the
          bank is.
        </li>
        <li>
          Stripe’s standard processing infrastructure is global (US/EU/etc.), and Stripe performs
          intra-group transfers — including to US-based affiliates — as part of operating that
          infrastructure. These intra-group transfers are governed by Stripe’s intra-group DPA,
          which we accepted at account onboarding (see §6.3).
        </li>
      </ul>
      <p>
        <strong>Conclusion:</strong> The art. 17 risk is best characterized as{' '}
        <strong>substantially mitigated, not fully avoided</strong>. The Canadian primary processing
        entity removes the most direct cross-border transfer; the remaining residual transfers
        (intra-Stripe US/EU replication) are governed by Stripe’s accepted DPA — the same
        risk-allocation mechanism every Canadian merchant using Stripe relies on. The processor
        obligations under Loi 25 art. 18 continue to apply via the DPA regardless of routing.
      </p>

      <h3>6. Mitigations</h3>
      <h4>6.1 Code-level minimization</h4>
      <ul>
        <li>
          <strong>Stripe-hosted Checkout</strong> chosen over Stripe Elements: no card data ever
          crosses the portal origin. PCI scope reduced to SAQ A.
        </li>
        <li>
          <strong>
            <code>customer_email</code> is the only PII
          </strong>{' '}
          sent on Checkout creation. Visitor’s name, address, phone are not transmitted.
        </li>
        <li>
          <strong>Stripe Tax is NOT enabled.</strong> Once revenue crosses the $30k QC
          small-supplier threshold and registration becomes mandatory, this PIA must be re-reviewed.
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
        email is sent by Stripe directly (not by the portal) to the visitor (not a third party). It
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
            <td>
              Confirm Stripe Payments Canada Ltd. as processing entity (account country = Canada)
            </td>
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
              Confirm <code>Stripe-Version: 2024-11-20.acacia</code> pin matches dashboard default
              OR update code
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
        <code>charge.refunded</code> webhook writes the refunded amount to{' '}
        <code>payments.refunded_amount_cents</code> on the portal side, and flips{' '}
        <code>payments.status</code> to <code>&apos;refunded&apos;</code> only on full refund;
        partial refunds leave the status as <code>&apos;paid&apos;</code> and surface the partial
        amount in the visitor&apos;s <code>/me</code> view. Refund timing and amount are also
        visible to the visitor in their Stripe receipt + the Customer Portal.
      </p>

      <h4>6.5 Visitor-facing notice (Loi 25 art. 8)</h4>
      <p>
        <code>/confidentialite</code> (FR) and <code>/en/privacy</code> (EN) §11 disclose: existence
        of Stripe Payments Canada Ltd., what is transmitted, the Canadian-processing posture,
        retention (per Stripe policy), and the rights-of-access path (via Customer Portal or written
        request to Marc).
      </p>

      <h3>7. Rights handling (art. 27 / 28 / 28.1)</h3>
      <ul>
        <li>
          <strong>Right of access:</strong> Stripe Customer Portal surfaces invoice history, card
          history, payment method. For a full export, Marc retrieves from the Stripe Dashboard on
          written request and delivers within 30 days.
        </li>
        <li>
          <strong>Right of rectification:</strong> card on file is changed in the Customer Portal.
          Billing address ditto. Receipts are immutable by design; a corrected receipt is issued as
          a credit note.
        </li>
        <li>
          <strong>Right of erasure:</strong> Stripe retains transaction records for{' '}
          <strong>7 years</strong> under FINTRAC + Income Tax Act obligations; they cannot be
          deleted on demand. The customer email can be anonymized on Stripe’s side, the local{' '}
          <code>payments</code> rows that link Stripe IDs to a marc-portal session can be deleted,
          and Stripe-side immutable financial records remain in place under the legal-obligation
          exception in Loi 25 art. 28.1.
        </li>
      </ul>

      <h3>8. Breach posture (art. 3.5 + 3.6)</h3>
      <p>
        Stripe has its own incident-response and breach-notification obligations under their DPA. In
        the event of a breach affecting marc-portal events: read Stripe’s incident report and
        identify the time window + affected accounts; for any affected visitor, notify within 72h by
        email (per Loi 25 art. 3.5 if the breach poses a risk of serious harm) and notify the CAI
        within the same 72h window (art. 3.6); log the incident in <code>RUNBOOK.md</code>.
      </p>

      <h3>9. Review schedule</h3>
      <p>
        Reviewed annually on the anniversary of integration (2026-05-16), whenever Stripe products
        change (e.g. enabling Stripe Tax, Stripe Connect, Issuing, Identity), whenever a Canadian
        processing-entity change is announced by Stripe, or whenever the marc-portal payment surface
        adds new data fields (currently: <code>customer_email</code> only).{' '}
        <strong>Next scheduled review: 2027-05-16.</strong>
      </p>
    </section>
  )
}

// ─── French versions ─────────────────────────────────────────────────────────
//
// Audience visée : un juriste québécois, un client en diligence raisonnable,
// la Commission d’accès à l’information. Registre formel (troisième personne,
// terminologie Loi 25). Les noms d’entité, identifiants techniques et noms
// de champs restent dans leur forme d’origine (« webhook », « customer_email »,
// « Stripe Payments Canada Ltd. ») — c’est ce que les destinataires
// cherchent à retrouver.

function PiaSentryFr() {
  return (
    <section id="sentry" className="privacy__section">
      <h2>Évaluation des facteurs relatifs à la vie privée — intégration Sentry</h2>
      <blockquote>
        <strong>Loi applicable :</strong> Loi 25 (Québec), art. 3.3 (obligation d’EFVP pour tout
        nouveau projet impliquant des renseignements personnels) et art. 17 (communications hors
        Québec).
        <br />
        <strong>Portée :</strong> Adoption de Sentry (sentry.io) comme service de surveillance
        d’erreurs pour le SPA marc-portal et ses Pages Functions.
        <br />
        <strong>Statut :</strong> Document interne. Non déposé auprès de la Commission d’accès à
        l’information (CAI) sauf sur demande. Source maintenue à <code>docs/loi-25-pia.md</code>.
      </blockquote>

      <h3>1. Identification</h3>
      <table className="pia-table">
        <tbody>
          <tr>
            <th>Projet</th>
            <td>Intégration Sentry pour la surveillance d’erreurs de marc-portal</td>
          </tr>
          <tr>
            <th>Date de l’EFVP</th>
            <td>2026-05-15</td>
          </tr>
          <tr>
            <th>Personne responsable (RPRP de fait)</th>
            <td>Marc Jeanson — marc@marcportal.com</td>
          </tr>
          <tr>
            <th>Portée opérationnelle</th>
            <td>
              marc-portal.pages.dev et tout domaine personnalisé rattaché au même projet Cloudflare
              Pages.
            </td>
          </tr>
          <tr>
            <th>Décision</th>
            <td>
              Procéder. Risque résiduel évalué à <strong>faible</strong> une fois les mesures
              d’atténuation de la §6 en place.
            </td>
          </tr>
        </tbody>
      </table>

      <h3>2. Description du traitement</h3>
      <p>
        L’interface visiteur de marc-portal (<code>@sentry/react</code>) et les Pages Functions (un
        envoi d’enveloppe maison dans <code>functions/_lib/sentry.ts</code>) transmettent un
        événement d’erreur à Sentry chaque fois que le code lève une exception non interceptée.
        L’événement est transmis par HTTPS à l’endpoint d’ingestion de Sentry en région
        états-unienne (<code>o4510241708244992.ingest.us.sentry.io</code>).
      </p>

      <h3>3. Inventaire des données</h3>
      <h4>3.1 Ce qui est transmis à Sentry</h4>
      <table className="pia-table">
        <thead>
          <tr>
            <th>Champ</th>
            <th>Source</th>
            <th>Renseignement personnel ?</th>
            <th>Pourquoi</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Message d’erreur, type</td>
            <td>
              <code>Error.message</code> et <code>.name</code> de l’exception levée
            </td>
            <td>Généralement non</td>
            <td>Nécessaire pour identifier le bogue</td>
          </tr>
          <tr>
            <td>Trace de pile</td>
            <td>
              <code>Error.stack</code> de l’exception levée
            </td>
            <td>Non (noms de fonctions, chemins de fichier)</td>
            <td>Nécessaire pour localiser le bogue</td>
          </tr>
          <tr>
            <td>Navigateur, système, version</td>
            <td>
              analyse de <code>User-Agent</code>
            </td>
            <td>Non (métadonnées techniques)</td>
            <td>Reproduire les bogues propres à un environnement</td>
          </tr>
          <tr>
            <td>Chemin de page</td>
            <td>
              <code>window.location.pathname</code> (chaîne de requête retirée)
            </td>
            <td>Non (chemin uniquement)</td>
            <td>« Où ça s’est produit »</td>
          </tr>
          <tr>
            <td>Étiquette d’environnement</td>
            <td>déduction à l’exécution</td>
            <td>Non</td>
            <td>Filtrer prod c. preview</td>
          </tr>
          <tr>
            <td>Fil d’Ariane (breadcrumbs)</td>
            <td>capture automatique du SDK Sentry (chaînes de requête retirées)</td>
            <td>Non</td>
            <td>Reproduire le parcours utilisateur menant à l’erreur</td>
          </tr>
          <tr>
            <td>
              Identité de l’utilisateur (<code>user.email</code>)
            </td>
            <td>uniquement lorsque le visiteur est l’opérateur (Marc)</td>
            <td>Le courriel de l’opérateur lui-même</td>
            <td>Permettre à Marc de filtrer ses propres erreurs de QA</td>
          </tr>
        </tbody>
      </table>

      <h4>3.2 Ce qui est explicitement exclu</h4>
      <ul>
        <li>
          <strong>Le courriel du visiteur</strong> — non transmis pour quiconque autre que
          l’opérateur.
        </li>
        <li>
          <strong>Les chaînes de requête d’URL</strong> — retirées avant l’envoi. Les jetons de lien
          magique, les identifiants de capacité de partage et <code>?lang=</code> y voyageraient
          autrement.
        </li>
        <li>
          <strong>Les en-têtes d’authentification</strong> — <code>Cookie</code>,{' '}
          <code>Authorization</code>, <code>X-CSRF-Token</code> sont supprimés dans{' '}
          <code>beforeSend</code> (client) et dans <code>requestSummary</code> (serveur).
        </li>
        <li>
          <strong>L’adresse IP</strong> — <code>sendDefaultPii: false</code> dans le SDK +{' '}
          <code>user.ip_address</code> annulé par mesure défensive. La bascule serveur de Sentry «
          Prevent Storing of IP Addresses » est activée.
        </li>
        <li>
          <strong>Les corps de requête</strong> — ni le SDK ni l’expéditeur d’enveloppe ne
          sérialisent de corps de requête.
        </li>
        <li>
          <strong>Les rejeux de session</strong> — <code>replaysSessionSampleRate: 0</code>,{' '}
          <code>replaysOnErrorSampleRate: 0</code>.
        </li>
        <li>
          <strong>Les traces de performance</strong> — <code>tracesSampleRate: 0</code>.
        </li>
      </ul>

      <h3>4. Finalités (Loi 25 art. 8)</h3>
      <p>
        Diagnostiquer et corriger les défauts logiciels qui affectent les visiteurs québécois. Sans
        surveillance d’erreurs, un défaut n’apparaît que lorsqu’un visiteur le signale explicitement
        — beaucoup ne le feront pas, et le visiteur subit en silence une expérience défectueuse. La
        surveillance d’erreurs est donc strictement nécessaire à la prestation du service au niveau
        de qualité auquel la pratique s’engage.
      </p>

      <h3>5. Évaluation du transfert hors Québec (Loi 25 art. 17)</h3>
      <table className="pia-table">
        <tbody>
          <tr>
            <th>Destinataire</th>
            <td>
              Functional Software Inc., faisant affaire sous le nom Sentry. 132 Hawthorne St, San
              Francisco, CA 94107, États-Unis.
            </td>
          </tr>
          <tr>
            <th>Juridiction</th>
            <td>
              États-Unis. Aucune loi fédérale omnibus équivalente à la Loi 25 ou au RGPD ;
              encadrement sectoriel. Sentry adhère volontairement au RGPD, au CCPA, à ISO 27001 et à
              SOC 2 Type II.
            </td>
          </tr>
          <tr>
            <th>Protection équivalente</th>
            <td>
              Obtenue par contrat via l’entente de traitement des données (DPA) de Sentry, les
              Clauses contractuelles types (SCC), et les mesures techniques d’atténuation de la §6.
              La combinaison offre une protection matériellement équivalente à la Loi 25 pour le jeu
              de données restreint en cause.
            </td>
          </tr>
          <tr>
            <th>Volume</th>
            <td>
              Faible. Un opérateur, environ un visiteur à la fois. Taux d’événements attendu : moins
              de 100 par mois.
            </td>
          </tr>
          <tr>
            <th>Sensibilité</th>
            <td>
              Télémétrie uniquement. Aucune catégorie particulière de renseignements personnels (CCQ
              art. 12 — santé, origine ethnique, etc.) ne touche au pipeline d’erreurs.
            </td>
          </tr>
          <tr>
            <th>Nécessité</th>
            <td>
              Opérationnellement requise pour livrer le niveau de qualité de service annoncé dans
              /confidentialite.
            </td>
          </tr>
        </tbody>
      </table>
      <p>
        <strong>Conclusion :</strong> le transfert est proportionnel au bénéfice opérationnel.
      </p>

      <h3>6. Mesures d’atténuation</h3>
      <h4>6.1 Minimisation (dans le code)</h4>
      <ul>
        <li>
          DSN codé en dur dans <code>src/lib/sentry.ts</code> et{' '}
          <code>functions/_lib/sentry.ts</code> — réduit la surface d’attaque liée aux variables
          d’environnement.
        </li>
        <li>
          <code>beforeSend</code> retire Cookie, Authorization, X-CSRF-Token, les chaînes de requête
          (dans l’événement et le fil d’Ariane), et annule <code>user.ip_address</code>.
        </li>
        <li>
          <code>setSentryUser</code> est gardé par le rôle admin : <code>Sentry.setUser(null)</code>{' '}
          pour tout visiteur non opérateur.
        </li>
        <li>
          Côté serveur, <code>requestSummary</code> n’émet que{' '}
          <code>
            ${'{origin}'}${'{pathname}'}
          </code>
          .
        </li>
      </ul>

      <h4>6.2 Risque résiduel : identifiants de capacité de partage dans les chemins d’URL</h4>
      <p>
        Les routes comme <code>/share/:id</code> portent un jeton de capacité de 72 bits dans le
        chemin de l’URL. La perte du jeton vers Sentry équivaut à la perte de l’URL de partage
        elle-même — que le visiteur était libre d’envoyer à qui il voulait.{' '}
        <strong>Risque résiduel : négligeable.</strong>
      </p>

      <h4>6.3 Compte Sentry / DPA (opérationnel)</h4>
      <table className="pia-table">
        <thead>
          <tr>
            <th>Action</th>
            <th>État</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Signer l’entente de traitement des données de Sentry (sentry.io/legal/dpa/)</td>
            <td>✅ 2026-05-15</td>
          </tr>
          <tr>
            <td>Rétention du projet = 30 jours</td>
            <td>✅ 2026-05-15 (valeur par défaut du plan Developer/gratuit)</td>
          </tr>
          <tr>
            <td>Activer « Prevent Storing of IP Addresses »</td>
            <td>✅ 2026-05-15</td>
          </tr>
          <tr>
            <td>Exiger Data Scrubber + Default Scrubbers</td>
            <td>✅ 2026-05-15</td>
          </tr>
          <tr>
            <td>Bascule Enhanced Privacy</td>
            <td>✅ 2026-05-15</td>
          </tr>
          <tr>
            <td>Compléter le supplément Global Sensitive Fields</td>
            <td>✅ 2026-05-15</td>
          </tr>
          <tr>
            <td>
              Documenter l’existence de cette EFVP dans <code>RUNBOOK.md</code>
            </td>
            <td>✅</td>
          </tr>
        </tbody>
      </table>

      <h4>6.4 Avis au visiteur (Loi 25 art. 8)</h4>
      <p>
        Les sections 2, 5 et 6 de <code>/confidentialite</code> (FR) et <code>/en/privacy</code>{' '}
        (EN) divulguent explicitement : l’existence de Sentry, ce qui est collecté, où ça va, la
        rétention, et le chemin de retrait. La section 7 explique la posture du droit d’accès.
      </p>

      <h3>7. Traitement des droits (art. 27 / 28 / 28.1)</h3>
      <ul>
        <li>
          <strong>Droit d’accès :</strong> les événements Sentry ne portent pas l’identité du
          visiteur. Lorsqu’un visiteur demande « qu’est-ce que vous avez sur moi ? », la réponse
          canonique concernant Sentry est « aucun événement à votre sujet précisément ; les
          événements Sentry sont anonymes ».
        </li>
        <li>
          <strong>Droit de rectification :</strong> sans objet pour des événements d’erreur.
        </li>
        <li>
          <strong>Droit à l’effacement :</strong> la rétention de 30 jours purge automatiquement.
        </li>
      </ul>

      <h3>8. Posture en cas d’incident (art. 3.5 + 3.6)</h3>
      <p>
        Sentry a ses propres obligations d’intervention sur incident et de notification de brèche en
        vertu de son DPA. En cas de brèche affectant les événements marc-portal : identifier les
        événements exposés ; selon §3.1, aucune information personnelle pour les visiteurs non
        opérateurs → pour les visiteurs, aucune notification à la CAI n’est requise (aucun risque de
        préjudice sérieux) ; pour les événements portant l’étiquette opérateur, aviser Marc
        (lui-même).
      </p>

      <h3>9. Calendrier de révision</h3>
      <p>
        Révisée annuellement à la date anniversaire de l’intégration (2026-05-15), chaque fois que
        la configuration de Sentry change, ou chaque fois que le modèle de données de marc-portal
        ajoute une classe de renseignements personnels susceptible d’apparaître dans une trace de
        pile. <strong>Prochaine révision prévue : 2027-05-15.</strong>
      </p>
    </section>
  )
}

function PiaStripeFr() {
  return (
    <section id="stripe" className="privacy__section">
      <h2>Évaluation des facteurs relatifs à la vie privée — intégration Stripe</h2>
      <blockquote>
        <strong>Loi applicable :</strong> Loi 25 (Québec), art. 3.3 (obligation d’EFVP pour tout
        nouveau projet impliquant des renseignements personnels) et art. 17 (communications hors
        Québec).
        <br />
        <strong>Portée :</strong> Adoption de Stripe comme processeur de paiements pour marc-portal
        (paiements ponctuels tier 1/2/3 + abonnements au mode dépositaire).
        <br />
        <strong>Statut :</strong> Document interne. Non déposé auprès de la Commission d’accès à
        l’information (CAI) sauf sur demande. Source maintenue à{' '}
        <code>docs/loi-25-pia-stripe.md</code>.
      </blockquote>

      <h3>1. Identification</h3>
      <table className="pia-table">
        <tbody>
          <tr>
            <th>Projet</th>
            <td>Stripe Checkout + Subscriptions pour marc-portal</td>
          </tr>
          <tr>
            <th>Date de l’EFVP</th>
            <td>2026-05-16</td>
          </tr>
          <tr>
            <th>Personne responsable (RPRP de fait)</th>
            <td>Marc Jeanson — marc@marcportal.com</td>
          </tr>
          <tr>
            <th>Portée opérationnelle</th>
            <td>
              marc-portal.pages.dev et tout domaine personnalisé rattaché au même projet Cloudflare
              Pages.
            </td>
          </tr>
          <tr>
            <th>Décision</th>
            <td>
              Procéder. Risque résiduel évalué à <strong>faible</strong> une fois les mesures
              d’atténuation de la §6 en place.
            </td>
          </tr>
        </tbody>
      </table>

      <h3>2. Description du traitement</h3>
      <p>
        Lorsqu’un visiteur clique sur <strong>Payer</strong> sur <code>/me</code> pour une session
        acceptée, le serveur marc-portal crée une session Stripe Checkout via l’API REST Stripe et
        redirige le navigateur vers la page de paiement hébergée par Stripe. Le visiteur saisit ses
        renseignements de carte directement dans la page Stripe —{' '}
        <strong>aucune donnée de carte ne transite ni n’est stockée par marc-portal</strong>. Après
        le paiement, Stripe envoie un webhook signé à <code>/api/payments/webhook</code>, qui met à
        jour l’entrée D1 locale et émet une confirmation. Pour l’abonnement en mode dépositaire, le
        même flux roule en <code>mode: subscription</code>, et les renouvellements sont gérés
        entièrement par Stripe.
      </p>

      <h3>3. Inventaire des données</h3>
      <h4>3.1 Ce que le portail transmet à Stripe</h4>
      <table className="pia-table">
        <thead>
          <tr>
            <th>Champ</th>
            <th>Source</th>
            <th>Renseignement personnel ?</th>
            <th>Pourquoi</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <code>customer_email</code>
            </td>
            <td>rangée de session</td>
            <td>
              <strong>Oui</strong> (courriel)
            </td>
            <td>Stripe envoie le reçu ; correspond au compte du visiteur</td>
          </tr>
          <tr>
            <td>
              <code>client_reference_id</code>
            </td>
            <td>
              l’identifiant <code>pay_*</code> du portail
            </td>
            <td>Non (opaque)</td>
            <td>Jointure d’idempotence sur webhook</td>
          </tr>
          <tr>
            <td>
              <code>metadata.payment_id</code>
            </td>
            <td>
              l’identifiant <code>pay_*</code> du portail
            </td>
            <td>Non (opaque)</td>
            <td>Idem ; transporté de bout en bout</td>
          </tr>
          <tr>
            <td>
              <code>metadata.session_id</code>
            </td>
            <td>l’identifiant de session du portail</td>
            <td>Non (opaque)</td>
            <td>Retrouver la session sur réception du webhook</td>
          </tr>
          <tr>
            <td>
              <code>metadata.kind</code>
            </td>
            <td>
              <code>tier1</code> / <code>tier2-deposit</code> / …
            </td>
            <td>Non (catégoriel)</td>
            <td>Catégorisation fiscale et comptable</td>
          </tr>
          <tr>
            <td>Libellé de ligne de facturation</td>
            <td>constante + titre optionnel du projet</td>
            <td>Non (nom du projet uniquement)</td>
            <td>Clarté du reçu</td>
          </tr>
          <tr>
            <td>
              <code>amount</code> ou <code>price_id</code>
            </td>
            <td>statique (TIER_AMOUNTS / env)</td>
            <td>Non</td>
            <td>Montant à facturer</td>
          </tr>
        </tbody>
      </table>

      <h4>3.2 Ce que le portail collecte via Stripe (mais ne stocke jamais)</h4>
      <p>
        Stripe collecte les données de carte, l’adresse de facturation (si Stripe Tax est activé —{' '}
        <strong>non activé</strong> dans ce projet), et tout numéro fiscal saisi par le visiteur
        dans le Customer Portal hébergé par Stripe. Rien de tout cela n’atteint le serveur
        marc-portal. Ces éléments vivent dans le coffre Stripe, sous leurs contrôles PCI-DSS de
        niveau 1.
      </p>

      <h4>3.3 Ce que le portail reçoit de Stripe (webhooks)</h4>
      <table className="pia-table">
        <thead>
          <tr>
            <th>Champ</th>
            <th>Stocké où</th>
            <th>Pourquoi</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <code>id</code> (identifiant d’objet Stripe)
            </td>
            <td>
              colonnes <code>payments.stripe_*_id</code>
            </td>
            <td>Idempotence + piste d’audit</td>
          </tr>
          <tr>
            <td>
              <code>amount_paid</code>, <code>amount_total</code>
            </td>
            <td>
              <code>payments.amount_cents</code> (recopié)
            </td>
            <td>Affichage, comptabilité</td>
          </tr>
          <tr>
            <td>
              <code>customer</code> (cus_…)
            </td>
            <td>
              <code>payments.stripe_customer_id</code>
            </td>
            <td>Ouvrir le Customer Portal plus tard</td>
          </tr>
          <tr>
            <td>
              <code>subscription</code> (sub_…)
            </td>
            <td>
              <code>payments.stripe_subscription_id</code> +{' '}
              <code>sessions.custodian_subscription_id</code>
            </td>
            <td>Lier les renouvellements à la session</td>
          </tr>
          <tr>
            <td>
              Type d’événement, <code>paid_at</code>
            </td>
            <td>
              <code>payments.status</code>, <code>paid_at</code>
            </td>
            <td>État du paiement</td>
          </tr>
        </tbody>
      </table>
      <p>
        Le courriel du visiteur n’est <strong>pas</strong> copié depuis le webhook vers la base du
        portail — il vit déjà sur la rangée de session. Les détails de carte (last4, marque, exp.)
        sont présents dans les charges utiles webhook de Stripe, mais explicitement non persistés
        (évitement du périmètre PCI).
      </p>

      <h4>3.4 Ce qui est explicitement exclu</h4>
      <ul>
        <li>
          <strong>Aucune donnée de carte.</strong> Le Checkout hébergé par Stripe signifie que le
          portail ne voit jamais PAN/CVC/exp. ; le périmètre PCI-DSS reste à SAQ A.
        </li>
        <li>
          <strong>Aucune adresse de facturation persistée côté portail.</strong>
        </li>
        <li>
          <strong>Aucune identité de client dans les événements Sentry.</strong> Le gestionnaire de
          webhook ne lève pas d’exception (il consigne + répond 200), donc son corps — qui contient
          le courriel du visiteur en provenance de Stripe — n’est jamais capté par Sentry.
        </li>
      </ul>

      <h3>4. Fondement juridique (Loi 25 art. 12, 12.1)</h3>
      <p>
        Le traitement est <strong>nécessaire à l’exécution du contrat</strong> que le visiteur a
        conclu en acceptant un prix de tier. Le paiement est la contrepartie ; sans lui,
        l’engagement ne peut s’achever. Le consentement est implicite dans l’acte de cliquer « Payer
        » ; le consentement exprès au transfert vers Stripe est donné par l’avis de confidentialité
        sur <code>/me</code>.
      </p>

      <h3>5. Analyse du transfert hors Québec (Loi 25 art. 17)</h3>
      <p>
        <strong>Distinction matérielle par rapport à Sentry :</strong> Stripe opère une entité de
        traitement canadienne, <strong>Stripe Payments Canada Ltd.</strong> (constituée en Ontario,
        inscrite à l’ARC). Selon la politique de confidentialité de Stripe et son Master Services
        Agreement, l’entité de traitement principale pour les paiements provenant de clients
        canadiens est Stripe Payments Canada Ltd. Cela signifie :
      </p>
      <ul>
        <li>
          Le transfert direct initié par marc-portal aboutit chez une entité canadienne de Stripe,
          ce qui <strong>réduit, sans toutefois l’éliminer,</strong> la surface au sens de la Loi 25
          art. 17 (par rapport à l’envoi direct vers un processeur exclusivement états-unien comme
          Sentry).
        </li>
        <li>
          Les réseaux de cartes (Visa / Mastercard / Amex) acheminent toujours les données à
          l’international, par construction du système de paiement mondial — mais marc-portal n’est
          pas l’entité qui effectue ce transfert ; c’est la banque.
        </li>
        <li>
          L’infrastructure standard de traitement de Stripe est mondiale (É.-U./UE/etc.) et Stripe
          effectue des transferts intragroupes — y compris vers ses affiliés états-uniens — dans le
          cadre de l’exploitation de cette infrastructure. Ces transferts intragroupes sont encadrés
          par le DPA intragroupe de Stripe, accepté lors de l’ouverture du compte (voir §6.3).
        </li>
      </ul>
      <p>
        <strong>Conclusion :</strong> Le risque art. 17 est mieux qualifié de{' '}
        <strong>substantiellement atténué, sans être totalement évité</strong>. L’entité de
        traitement principale canadienne supprime le transfert transfrontalier le plus direct ; les
        transferts résiduels (réplication intra-Stripe É.-U./UE) sont encadrés par le DPA accepté
        avec Stripe — le même mécanisme d’allocation de risque sur lequel s’appuie chaque marchand
        canadien utilisant Stripe. Les obligations du processeur prévues à la Loi 25 art. 18
        continuent de s’appliquer via le DPA, peu importe l’acheminement.
      </p>

      <h3>6. Mesures d’atténuation</h3>
      <h4>6.1 Minimisation au niveau du code</h4>
      <ul>
        <li>
          <strong>Checkout hébergé par Stripe</strong> retenu plutôt que Stripe Elements : aucune
          donnée de carte ne traverse l’origine du portail. Périmètre PCI réduit à SAQ A.
        </li>
        <li>
          <strong>
            <code>customer_email</code> est le seul renseignement personnel
          </strong>{' '}
          transmis à la création du Checkout. Le nom, l’adresse et le téléphone du visiteur ne sont
          pas transmis.
        </li>
        <li>
          <strong>Stripe Tax n’est PAS activé.</strong> Dès que le chiffre d’affaires franchira le
          seuil québécois de petit fournisseur (30 000 $) et que l’inscription deviendra
          obligatoire, cette EFVP devra être révisée.
        </li>
        <li>
          <strong>Le gestionnaire de webhook répond 200 et consigne en cas d’échec</strong> — il ne
          lève pas d’exception, donc Sentry ne reçoit jamais un corps de webhook Stripe.
        </li>
        <li>
          <strong>Le Customer Portal est gardé</strong> par la propriété du visiteur sur la session.
        </li>
      </ul>

      <h4>6.2 Risque résiduel : reçus envoyés par Stripe</h4>
      <p>
        Stripe envoie un reçu à <code>customer_email</code> pour chaque débit réussi. Ce courriel
        est envoyé par Stripe directement (pas par le portail) au visiteur (pas à un tiers). Il
        contient le libellé de ligne et le montant. <strong>Risque résiduel : négligeable.</strong>
      </p>

      <h4>6.3 Compte Stripe / DPA (opérationnel)</h4>
      <table className="pia-table">
        <thead>
          <tr>
            <th>Action</th>
            <th>État</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              Confirmer Stripe Payments Canada Ltd. comme entité de traitement (pays du compte =
              Canada)
            </td>
            <td>⬜ à confirmer à l’activation</td>
          </tr>
          <tr>
            <td>
              Signer le Services Agreement + DPA de Stripe (acceptation en ligne à l’inscription)
            </td>
            <td>⬜ effectué à l’activation</td>
          </tr>
          <tr>
            <td>Désactiver « Email me when test mode events happen » une fois en production</td>
            <td>⬜</td>
          </tr>
          <tr>
            <td>Définir le secret de signature webhook sur l’endpoint production</td>
            <td>⬜</td>
          </tr>
          <tr>
            <td>
              Confirmer que la pin <code>Stripe-Version: 2024-11-20.acacia</code> correspond à la
              valeur par défaut du tableau de bord OU mettre à jour le code
            </td>
            <td>⬜</td>
          </tr>
          <tr>
            <td>
              Activer une politique de rotation des clés restreintes (rotation annuelle des{' '}
              <code>sk_live_*</code>)
            </td>
            <td>⬜</td>
          </tr>
          <tr>
            <td>
              Documenter l’existence de cette EFVP dans <code>RUNBOOK.md</code>
            </td>
            <td>✅</td>
          </tr>
        </tbody>
      </table>

      <h4>6.4 Traitement des remboursements et des reversements</h4>
      <p>
        Si un visiteur demande un remboursement, Marc l’émet depuis le tableau de bord Stripe. Le
        webhook <code>charge.refunded</code> écrit le montant remboursé dans{' '}
        <code>payments.refunded_amount_cents</code> côté portail, et bascule{' '}
        <code>payments.status</code> à <code>&apos;refunded&apos;</code> seulement lors d’un
        remboursement complet ; les remboursements partiels laissent le statut à{' '}
        <code>&apos;paid&apos;</code> et exposent le montant partiel dans la vue <code>/me</code> du
        visiteur. Le moment et le montant du remboursement sont aussi visibles pour le visiteur dans
        son reçu Stripe + le Customer Portal.
      </p>

      <h4>6.5 Avis au visiteur (Loi 25 art. 8)</h4>
      <p>
        La section 11 de <code>/confidentialite</code> (FR) et <code>/en/privacy</code> (EN)
        divulgue : l’existence de Stripe Payments Canada Ltd., ce qui est transmis, la posture de
        traitement canadien, la rétention (selon la politique Stripe), et le chemin du droit d’accès
        (via le Customer Portal ou demande écrite à Marc).
      </p>

      <h3>7. Traitement des droits (art. 27 / 28 / 28.1)</h3>
      <ul>
        <li>
          <strong>Droit d’accès :</strong> le Customer Portal de Stripe expose l’historique des
          factures, l’historique des cartes, le mode de paiement. Pour un export complet, Marc
          extrait depuis le tableau de bord Stripe sur demande écrite et livre dans les 30 jours.
        </li>
        <li>
          <strong>Droit de rectification :</strong> la carte au dossier se modifie dans le Customer
          Portal. Idem pour l’adresse de facturation. Les reçus sont immuables par construction ; un
          reçu corrigé est émis sous forme de note de crédit.
        </li>
        <li>
          <strong>Droit à l’effacement :</strong> Stripe conserve les enregistrements de
          transactions pendant <strong>7 ans</strong> en vertu des obligations CANAFE + Loi de
          l’impôt sur le revenu ; ils ne peuvent être supprimés sur demande. Le courriel client peut
          être anonymisé du côté Stripe, les rangées <code>payments</code> locales qui lient les
          identifiants Stripe à une session marc-portal peuvent être supprimées, et les
          enregistrements financiers immuables côté Stripe demeurent en vertu de l’exception
          d’obligation légale prévue à la Loi 25 art. 28.1.
        </li>
      </ul>

      <h3>8. Posture en cas d’incident (art. 3.5 + 3.6)</h3>
      <p>
        Stripe a ses propres obligations d’intervention sur incident et de notification de brèche en
        vertu de son DPA. En cas de brèche affectant les événements marc-portal : lire le rapport
        d’incident de Stripe et identifier la fenêtre temporelle + les comptes touchés ; pour tout
        visiteur affecté, aviser dans les 72 h par courriel (en vertu de la Loi 25 art. 3.5 si la
        brèche pose un risque de préjudice sérieux) et aviser la CAI dans la même fenêtre de 72 h
        (art. 3.6) ; consigner l’incident dans <code>RUNBOOK.md</code>.
      </p>

      <h3>9. Calendrier de révision</h3>
      <p>
        Révisée annuellement à la date anniversaire de l’intégration (2026-05-16), chaque fois que
        les produits Stripe changent (p. ex. activation de Stripe Tax, Stripe Connect, Issuing,
        Identity), chaque fois qu’un changement d’entité de traitement canadienne est annoncé par
        Stripe, ou chaque fois que la surface de paiement de marc-portal ajoute de nouveaux champs
        de données (actuellement : <code>customer_email</code> uniquement).{' '}
        <strong>Prochaine révision prévue : 2027-05-16.</strong>
      </p>
    </section>
  )
}
