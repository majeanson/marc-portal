# Privacy Impact Assessment — Stripe integration

> **Statute:** Loi 25 (Quebec), art. 3.3 (PIA requirement for new
> projects involving personal info) and art. 17 (cross-border transfers).
> **Scope:** Adoption of Stripe as the payments processor for marc-portal
> (Tier 1/2/3 one-time payments + custodian-mode subscriptions).
> **Status:** Internal record. Not filed with the Commission d'accès à
> l'information (CAI) unless requested. Maintained at
> `docs/loi-25-pia-stripe.md`.

---

## 1. Identification

| Field | Value |
|---|---|
| **Project** | Stripe Checkout + Subscriptions for marc-portal |
| **Date of PIA** | 2026-05-16 |
| **Person responsible** (DPO de fait) | Marc Jeanson — marc@marcportal.com |
| **Operational scope** | marc-portal.pages.dev and any custom domain attached to the same Cloudflare Pages project. |
| **Decision** | Proceed. Residual risk assessed as **low** after the mitigations in §6 are in place. |

## 2. Description of the processing

When a visitor (the client) clicks **Pay** on `/me` for an accepted
session, the marc-portal server creates a Stripe Checkout session via
the Stripe REST API and redirects the browser to Stripe's hosted
payment page. The visitor enters their card details directly into
Stripe's page — **card data never transits or is stored by
marc-portal**. After payment, Stripe sends a signed webhook to
`/api/payments/webhook`, which updates the local D1 record and emits a
confirmation. For the custodian-mode subscription, the same flow runs
in `mode: subscription`, and renewals are handled entirely by Stripe
(yearly auto-charge → webhook → D1 update).

## 3. Data inventory

### 3.1 What we transmit to Stripe

| Field | Source | Personal info? | Why |
|---|---|---|---|
| `customer_email` | session row | **Yes** (email) | Stripe sends receipt; matches visitor's account |
| `client_reference_id` | our `pay_*` id | No (opaque) | Webhook idempotency join |
| `metadata.payment_id` | our `pay_*` id | No (opaque) | Same; carried through |
| `metadata.session_id` | our session id | No (opaque) | Locate the session on webhook |
| `metadata.kind` | `tier1` / `tier2-deposit` / … | No (categorical) | Tax/accounting categorization |
| Line-item label | constant + optional showcase title | No (project name only) | Receipt clarity |
| `amount` (one-time) or `price_id` (sub) | static (TIER_AMOUNTS / env) | No (price) | Amount to charge |

### 3.2 What we collect via Stripe (but never store ourselves)

Stripe collects card data, billing address (if Stripe Tax is enabled —
**not enabled** in this project), and any tax-ID the visitor enters in
the Stripe-hosted Customer Portal. None of these reach the marc-portal
server. They live in Stripe's vault under their PCI-DSS Level 1
controls.

### 3.3 What we receive from Stripe (webhooks)

| Field | Stored where | Why |
|---|---|---|
| `id` (Stripe object id) | `payments.stripe_*_id` columns | Idempotency + audit trail |
| `amount_paid`, `amount_total` | `payments.amount_cents` (echoed) | Display, accounting |
| `customer` (cus_…) | `payments.stripe_customer_id` | Open Customer Portal later |
| `subscription` (sub_…) | `payments.stripe_subscription_id` + `sessions.custodian_subscription_id` | Map renewals back to session |
| Event type, `paid_at` | `payments.status`, `paid_at` | Status of the payment |

Visitor's email is **not** copied from the webhook into our DB — we
already have it on the session row. Card details (the last4, brand,
exp) are present in Stripe's webhook payloads but we explicitly do not
persist them (PCI scope avoidance; we don't need them).

### 3.4 What is explicitly excluded

- **No card data.** Stripe-hosted Checkout means we never see PAN/CVC/
  exp; we never become PCI-DSS in-scope beyond SAQ A (the lowest tier,
  satisfied by simply using Stripe Checkout per their attestation).
- **No billing address persisted on our side.** Stripe collects it for
  receipt + tax purposes; we do not echo it into D1.
- **No client identity in our Sentry events.** The `/api/payments/*`
  endpoints run under the same middleware as the rest; `beforeSend`
  strips cookies, auth headers, query strings. The webhook handler
  does not re-throw (it logs + 200s), so its body — which contains
  visitor email from Stripe — is never captured by Sentry.

## 4. Lawful basis (Loi 25 art. 12, 12.1)

The processing is **necessary for the performance of the contract**
the visitor entered into when accepting a tier price. The payment is
the consideration; without it the engagement cannot complete. Consent
is implicit in the act of clicking "Pay"; explicit consent for the
Stripe transfer is given via the privacy notice on `/me` (see §6.5).

## 5. Cross-border transfer analysis (Loi 25 art. 17)

**Material distinction from Sentry:** Stripe operates a Canadian
processing entity, **Stripe Payments Canada Ltd.** (incorporated in
Ontario; CRA registered). Per Stripe's privacy policy and Master
Services Agreement, payments originating from Canadian customers are
processed by Stripe Payments Canada Ltd. This means:

- The processing **is not a cross-border transfer** for purposes of
  Loi 25 art. 17 (which governs transfers *outside* Quebec/Canada).
- Card networks (Visa / Mastercard / Amex) still route data
  internationally as a function of the global payment system — but
  marc-portal is not the entity making that transfer; the bank is.
- Stripe's standard processing infrastructure is global (US/EU/etc.),
  and Stripe transfers data internally per their intra-group DPA. We
  rely on Stripe's adequate-protection commitments under their privacy
  policy and the Stripe DPA.

**Conclusion:** Loi 25 art. 17 obligations are met by virtue of using
the Canadian entity. The DPA with Stripe Payments Canada Ltd. (signed
during account onboarding — see §6.3) covers the remaining processor
obligations under art. 18.

## 6. Mitigations

### 6.1 Code-level minimization

- **Stripe-hosted Checkout** chosen over Stripe Elements: no card data
  ever crosses our origin. Reduces PCI scope to SAQ A; reduces
  attack surface to zero.
- **`customer_email` is the only PII** sent on Checkout creation.
  Visitor's name, address, phone, billing address are not transmitted.
- **Stripe Tax is NOT enabled** in this project; once revenue crosses
  the $30k QC small-supplier threshold and registration becomes
  mandatory, this PIA must be re-reviewed (Stripe Tax collects more
  PII).
- **Webhook handler returns 200 + logs on failure** — does not
  re-throw, so Sentry never receives a Stripe webhook body.
- **Customer Portal is gated** by visitor ownership of the session
  (admin can portal-into any session for support purposes; visitor
  can only access their own).

### 6.2 Residual risk: receipt emails sent by Stripe

Stripe emails a receipt to `customer_email` on every successful
charge. This email is sent by Stripe directly (not us) to the visitor
(not a third party). It contains the line-item label (which is
"Tier 2 — [project name]" by default) and the amount. The line-item
label could leak the project name to anyone who can read the
visitor's email — which is the visitor. **Residual risk:
negligible.**

### 6.3 Stripe account / DPA (operational)

| Action | Owner | Status |
|---|---|---|
| Confirm Stripe Payments Canada Ltd. as processing entity (account country = Canada at signup) | Marc | ⬜ confirm at activation; default for Canadian SIN |
| Sign Stripe's Services Agreement + DPA (click-through at signup) | Marc | ⬜ done at activation |
| Disable "Email me when test mode events happen" once live | Marc | ⬜ |
| Set webhook endpoint signing secret on the live endpoint | Marc | ⬜ obtain from Dashboard → Webhooks |
| Confirm `Stripe-Version: 2024-11-20.acacia` pin matches dashboard default OR update code | Marc | ⬜ |
| Enable "Restricted-key" rotation policy on the Stripe Dashboard | Marc | ⬜ rotate sk_live_* yearly |
| Document this PIA exists in `RUNBOOK.md` | Done | ✅ |

### 6.4 Refund / reversal handling

If a visitor requests a refund (per FAQ: any time mid-project), Marc
issues it from the Stripe Dashboard. The `charge.refunded` webhook
updates `payments.status = 'refunded'` on our side. Refund timing and
amount are visible to the visitor in their Stripe receipt + the
Customer Portal.

### 6.5 Visitor-facing notice (Loi 25 art. 8)

`/confidentialite` (FR) and `/en/privacy` (EN) are updated with a new
section disclosing: existence of Stripe Payments Canada Ltd., what is
transmitted, the Canadian-processing posture, retention (per Stripe
policy), and the rights-of-access path (via Customer Portal or
written request to Marc).

## 7. Rights handling (art. 27 / 28 / 28.1)

- **Right of access (art. 27)**: visitor can self-serve via the Stripe
  Customer Portal (`/api/payments/portal`) — Stripe surfaces invoice
  history, card history, payment method. For a full export beyond
  what the Portal shows, Marc retrieves it from the Stripe Dashboard
  on written request and delivers within 30 days.
- **Right of rectification (art. 28)**: card on file is changed in
  the Customer Portal. Billing address ditto. Receipts are immutable
  by design (auditing); a corrected receipt is issued as a credit
  note if the visitor requests it.
- **Right of erasure (art. 28.1)**: complex. Stripe retains
  transaction records for **7 years** under FINTRAC + Income Tax Act
  obligations; we cannot delete them on demand without breaking the
  audit trail. We can:
  1. Anonymize the `customer_email` on the Stripe customer object
     (replace with `deleted+<id>@marc-portal.invalid`).
  2. Delete the local `payments` rows that link Stripe IDs to a
     marc-portal session (the visitor-side personal-info linkage).
  3. Decline to delete the Stripe-side immutable financial records,
     citing the legal-obligation exception in Loi 25 art. 28.1.
  This is the same posture every Quebec business that processes
  payments must adopt.

## 8. Breach posture (art. 3.5 + 3.6)

Stripe has its own incident-response and breach-notification
obligations under their DPA. In the event Stripe notifies Marc of a
breach affecting marc-portal events:

1. Read Stripe's incident report; identify the time window + affected
   accounts.
2. For any affected visitor: notify them within 72h by email at the
   address on the session (per Loi 25 art. 3.5 if the breach poses a
   risk of serious harm). Stripe-managed card data leaks would be
   such a case.
3. Notify the CAI within the same 72h window (Loi 25 art. 3.6).
4. Log the incident in `RUNBOOK.md` with date + Stripe's incident ID.

## 9. Review schedule

This PIA is reviewed:
- Annually on the anniversary of integration (**2026-05-16**).
- Whenever Stripe products change (e.g. enabling Stripe Tax, Stripe
  Connect, Issuing, Identity).
- Whenever a Canadian processing-entity change is announced by Stripe.
- Whenever the marc-portal payment surface adds new data fields
  (currently: customer_email only).

Next scheduled review: **2027-05-16**.

---

*Signed off-line. Internal record. Provide on request to CAI under
art. 81.*
