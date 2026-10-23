# marcportal.com — stranger review (2026-10-23)

Visited cold, as someone who landed from a link: home, `/intake` (step 1 only — step 2 is
account creation, not done), `/projects` and its filters. Desktop (800 px) and phone (375 px).
Judged on what the page shows, not on the code.

## First impression

The voice is the asset: warm, Québécois, honest (« garde ton argent »), with a real face and
real shipped projects. What a stranger misses is the **one sentence that says what this is**.
The hero is a mood (« Une tâche ennuyeuse qui revient chaque semaine… Raconte-moi la tienne »);
you only learn that Marc is a dev who builds small tools for a fee further down. The meta
description says it best and is invisible on the page: « Marc, dev québécois. Le soir et la
fin de semaine, j'aide les gens à régler des problèmes du quotidien avec du code. »

## Friction, most important first

1. **No one-line "who / what / price" above the fold.** Add a small line under the hero, e.g.
   « Je suis Marc, dev. Je te bâtis le petit outil qui règle ça — à partir de 750 $, ou je te
   montre comment le faire gratis. » The tiers are the strongest selling point and sit
   ~8 screens down.
2. **Contact = make an account.** Footer: « Contact : démarre une session et on en parle là »,
   and intake step 2 is « Compte ». A curious stranger with a half-idea will not create an
   account to ask « is this the kind of thing you do? ». Consider letting step 1–4 be
   anonymous and asking for an email/account only at « Reçu », or a tiny « pose une question »
   path.
3. **Scroll-reveal leaves blank screens.** Scrolling at normal speed on desktop showed a fully
   empty viewport (a single grey placeholder block) for about a second around the project
   cards, and step « 04 Je livre » rendered faded. On a fast flick this reads as broken. Show
   content immediately and animate only the transform, or reveal earlier (bigger rootMargin).
4. **The « Ce que je fais / je fais pas » list is repeated three times** (home section V,
   intake step 1, and paraphrased in VI). Once on home and once as the intake gate is enough.
5. **`/projects` is titled « Projets en cours » but every card is SHIPPED**, and the status
   filters « en cours », « brouillon », « triage », « refusé » all return « Aucun projet ne
   correspond ». Four dead filters out of six. Hide empty filters (or show counts: « livré 9 »),
   and rename the page « Projets livrés » / « La galerie » while nothing is in progress.
6. **Price mismatch:** home says « Niveau 4 · 7 500 $+ », the gallery says « Niveau 4 · sur
   devis ». Pick one.
7. **Gallery thumbnails don't match the site's language.** The Horizon card shows the app in
   English (« You can retire at age 60 ») on a French page. Re-shoot thumbnails in FR (and
   swap them in EN mode).
8. **`og:image` is a relative path (`/og-image.png`).** Several link-preview scrapers
   (Facebook, LinkedIn, some Slack paths) need an absolute URL; the other four sites already
   use absolute ones.
9. **« 1 place ouverte »** is good scarcity, but nothing says *per what* (month? at once?).
   « 1 place ouverte ce mois-ci » makes it concrete.
10. **The project card for « Ton projet pourrait être ici »** is a tall, mostly empty box on
    desktop. Shrink it to the height of its text or fill it with the tier ladder.

## Intake, steps 2–4 (signed in)

Walked with Marc's own signed-in account (step 2 showed « connecté en tant que … », « Continuer
avec ce compte »), picked « Suivi » at step 3, read step 4. Nothing typed (fields autosave) and
nothing submitted, so step 5 « Reçu » was not seen.

1. **Step 4 asks a stranger about DNS, Cloudflare and Resend.** « Préférence de gestion » :
   « Tout à toi : je gère DNS, Cloudflare, Resend moi-même » vs « Marc garde les clés ». A
   food-truck owner doesn't know these words, and it's the last thing before Soumettre. Move it
   to after triage (when a price is on the table), or reword in plain terms (« Je m'occupe de
   l'hébergement pour toi — forfait annuel » / « Je te remets tout et tu t'en occupes »), and
   keep « On en parle plus tard » as the default.
2. **Voice flips between « je » and « Marc »** on the same screen: « Marc va le lire et le
   rediriger » (step 3 intro) vs « Je regarde ce qu'il a, puis je le répare » (Réparer card);
   step 4 says « Marc s'en occupe » next to « je gère ». Pick first person throughout — the
   home page promises « pas d'IA entre toi et moi ».
3. **« RESCUE » is the only English eyebrow** in a French list (PAPERASSE, SUIVI,
   COORDINATION, AUTRE). « RÉPARATION ». Also, « Autre » sits *before* « Réparer » — put the
   catch-all last.
4. **Placeholder examples are longer than their boxes**: on desktop every textarea cuts its
   example mid-line with a scrollbar (« …les projets en cours et qui s'occupe de quoi » is
   clipped). Shorten the examples or auto-grow the box to fit the placeholder.
5. **French question marks are missing their space**: « Quel genre de problème? »,
   « Qu'est-ce que tu suis exactement? », « Combien d'entrées environ? », « …l'idéal? » — the
   rest of the site uses « » and thin spaces correctly (« Les mots ne suffisent pas ? »).
6. **« ✓ Sauvegardé automatiquement à chaque champ » shows before anything is typed.** It
   reads as a status (« saved ») rather than a promise. « Chaque champ se sauvegarde tout seul »
   until the first save, then « Sauvegardé · 12 h 04 ».
7. **The submit rule is easy to miss**: « Écris quelques mots, fais un croquis ou laisse une
   note vocale pour soumettre » sits under the sketch/voice links, far below the first box. Put
   « un seul champ suffit pour soumettre » near the top of step 4 — five empty boxes look like
   five required answers.

## After submitting: Reçu, the session, Mon espace (client preview)

Using Marc's « voir comme visiteur » preview, a test request was filled (two fields, marked
« TEST — revue étranger (Claude) ») and submitted: session **`d0svlU3M`** — bin it from the
admin inbox. Preview can't show the magic-link signup e-mail or an empty « Mes sessions » list,
so a brand-new client's first visit is still unseen.

1. **After « Soumettre » the page stays scrolled at the footer.** On a phone the first thing
   seen after submitting is « L'atelier de Marc · Contact · Carte du site », not « Merci, c'est
   reçu ». Scroll to the top of the Reçu card (and move focus to its heading for screen readers).
2. **« Reçu » then « DRAFT / Brouillon ».** The confirmation says « Merci, c'est reçu », but the
   session page and the list label it **DRAFT** (in English) and the progress bar sits on
   « 01 · Brouillon ». To the client it was sent; call that state « Envoyée » / « Reçue », and
   translate the badge.
3. **Same promise, three wordings:** « réponse honnête en 72 h » (twice on the Reçu card, back
   to back), « Réponse de Marc dans 3 jours », « Marc répond en moins de 72h ». Pick one, say it
   once.
4. **The header overlaps on the session page at phone width** (375 px and 335 px): « ← Mes
   sessions » slides under the search button and collides with the « Mes sessions » link,
   giving « ← Mes s🔍Mes sessions ». Only one back link is needed there.
5. **The thread starts empty.** Conversation shows « Marc répond en moins de 72h. Laisse-lui un
   mot » — but not what was just sent. Show the submitted answers as the first message so the
   client sees their request where the reply will come.
6. **Sessions are named by ID** (« Session d0svlU3M »), in the page title and the list.
   Use the first answer or the type as the title (« Suivi — club de course du dimanche ») and
   keep the ID small.
7. **Too many names for the same things.** The header says « Mes sessions », the page says
   « CONSOLE · Mon espace »; a request is a « session », a « proposition » (« Ta proposition est
   enregistrée », « Nouvelle proposition »), a « demande » and an « intake » (« Démarre un
   intake »). « Session sans intake » also shows in the list — internal wording reaching the
   client. Pick « demande » (client side) and keep « intake / session » for the admin.
8. **« Mon espace » is one very long page** on a phone: summary cards, 12 sessions, a test
   payment button, name, e-mail language, sign-out, delete account. Collapse past sessions
   after 3 (« voir les 9 livrées »).
9. **E-mail language choice reads « Tu / OQLF / 1 800 $ » vs « You / standard / $1,800 »** —
   clever, but a stranger won't know why their price format is in a language picker. « Français
   — tutoiement, 1 800 $ » is clearer.

Good: « Mes données » (Loi 25 access, in plain text and JSON) and a clear, honest « Supprimer
mes données » are rare and build trust; « Sauver le dossier en PDF » on Reçu is a thoughtful
touch; empty fields are left out of the recap instead of showing blanks; the thread accepts
files, voice notes and sketches like the intake.

Good (steps 1–4): the step pills (01–05) make progress clear; the type cards are concrete (« ce qui mange
ton dimanche soir »); sketch and voice-note alternatives are a great touch for people who don't
write easily; « Changer de type » keeps the way back visible.

## Other public pages (/parcours, /tier-0, /handoff, /share, /en)

1. **« Modèle Google Sheets (à dupliquer) » doesn't open a template** — both links on
   `/tier-0` go to the generic Sheets home (`docs.google.com/spreadsheets/u/0/?tgif=d`). The
   one promise a Niveau 0 visitor acts on fails. Publish the two sheets and link
   `…/copy` URLs so « dupliquer » is one click.
2. **`/tier-0` says « une de ces 4 catégories »** and then lists about ten recipes
   (rotation, sondage, registre, inventaire, potluck, partage des coûts, échange, and ones
   pointing at Google Forms, Trello and Brevo).
3. **The order in `/parcours` contradicts the intake.** Parcours: 02 « Tu décris ton
   problème », 03 « Le lien de connexion arrive ». Intake: 02 Compte, *then* 03 Type / 04
   Détails. Either let people describe first (better, see friction #2) or fix the page.
4. **« Tier » leaks into French copy**: « Si tu as 4+ employés, là c'est Tier 2 » on `/tier-0`;
   « T0–T4 » filter chips on `/projects`. Everywhere else it's « Niveau ».
5. **Share page `/share/<id>` has a generic title** (« Avancées du build — Marc ») and no
   project name in its heading — a shared link for Babillard doesn't say « Babillard » in the
   tab or the preview. Its intro is admin wording (« Étapes du build avec un lien vers le
   déploiement Cloudflare correspondant »). « Babillard — l'histoire du projet » and a sentence
   for humans.
6. **Testimonials are empty on every share page seen** (« Pas encore de témoignages ») — the
   block advertises the gap. Hide it until there is one, or ask the real users of Babillard /
   Truck notes for a line.
7. **Brand spelled three ways**: « marc.portal » (header), « MARC.PORTAIL » (parcours map),
   « Marc Portal » (home link label).
8. **`/handoff` calls clients « visiteurs »** (« Pour visiteurs déjà à l'aise avec leur
   stack », « Réservé aux visiteurs autonomes ») and switches to « Marc n'assure plus le
   service » mid-page. The plan names Watch / Care are English in the FR page.
9. **EN home CTA differs in meaning**: FR « Décris ton problème » vs EN « Start a new
   proposal » (signed in). « Proposal » sounds like *Marc* proposes; « Tell me about your
   problem » keeps the voice.

Good: `/parcours` (12 steps, who does what, time per step, « 0 appels ») is the clearest page
on the site and deserves a link from the hero; `/tier-0` is generous and honest (« Pas de
honte… tu n'as pas besoin de moi »); `/handoff` is unusually transparent about lock-in, with
prices (Watch 120 $/an · Care 400 $/an) and a free, no-question exit; the share page's
« Machine à remonter » build timeline is a great portfolio device.

**Weight note:** the home page loads two live-build iframes and 18 resources
(~1.4 MB decoded, warm cache), and its DOMContentLoaded was ~880 ms vs 120–500 ms for the four
apps. The iframes are what make the gallery feel alive, but on the home page a static
thumbnail that swaps to the live build on tap would cut most of it.

## Admin side of the same test session

`/admin/inbox` and `/session/d0svlU3M…` as Marc, preview off.

1. **A new request lands in no « À traiter » bucket.** The buckets are « Active sans tier »,
   « Tier 4 sans devis », « Livrée — mode à choisir », « Dépositaire en retard ». A fresh
   submission (status DRAFT) counts in none of them, so the to-do row reads « 0 » for the one
   thing that needs a reply within 72 h. Add « Nouvelle — à répondre » first, with the hours
   left (« reçue il y a 2 h · reste 70 h »).
2. **The inbox isn't sorted by what needs attention.** The new request sits second, under an
   ACTIVE session last touched 8 days earlier; nothing marks it new/unread.
3. **The admin sees the client's countdown.** « Réponse de Marc dans 3 jours » is shown to Marc
   himself, on the inbox row and the session. For the admin it should be a due date (« à
   répondre d'ici le lun. 26 oct. »).
4. **No one-tap triage.** The promise is « oui, non, ou raconte-moi plus », but the admin
   session has no such three buttons — status pills (« Clique une étape pour changer le statut »,
   applied on a single tap, no confirmation) and an empty conversation. Three buttons that post
   a templated reply *and* move the status would make the 72 h promise cheap to keep.
5. **Two parallel price controls in « Opérateur »**: « Tier et tarification » (T0–T4, drives
   the client's Pay button) and « Niveau » (Niveau 0–4, « calibre la session par rapport à la
   grille »). Same five steps, two names, two saves. Merge them or explain the difference inline.
6. **The Intake tab speaks to the client** (« Ce que tu m'as envoyé », « Tes réponses ») when
   read by the admin. « Ce que le client a envoyé ».
7. **Two back links** on the admin session (« ← Mes sessions » in the header, « ← Retour à la
   liste » in the page), and the header one says « Mes sessions » while it's the admin inbox.
8. **Activity log has only « Créée »** — submission isn't a separate event, so « drafted at
   12 h 10, submitted at 12 h 19 » is lost.

Good: the operator notes box (« le visiteur ne le voit jamais », 4 096-char counter), the
showcase publish fields with an EN fallback note, and the build-progress composer
(« Épingler comme build actuel », phone-frame preview) are well thought out.

## Ops: the Resend webhook is failing (from Marc's dashboard screenshots)

`POST https://marcportal.com/api/webhooks/resend` answers **401 `{"error":"signature
mismatch"}`** to every event since ~2026-10-16 (last successes « 8d ago », i.e. the 10-15
activation day), and Resend has now **disabled** the endpoint. Bounces/complaints therefore
stopped reaching `email_events`, so send-time suppression (P1.11) is working from stale data.

What the code says:
- `functions/_lib/resendWebhook.ts` hasn't changed since May; it strips `whsec_`, HMACs
  `id.ts.rawBody`, and the handler reads `request.text()` before anything parses it. The
  body is the handler's own JSON, so the request is reaching the Function (not a WAF block —
  the 10-16 Bot Fight Mode change in RUNBOOK 25 would answer with a Cloudflare page, not this).
- The verifier returns the same « signature mismatch » for a **stale timestamp** (> 5 min) as
  for a wrong key. Attempts « 1 », 21 min old → delivered immediately, so timing is unlikely.
- Most likely: the `RESEND_WEBHOOK_SECRET` the Pages project runs with is not this endpoint's
  current signing secret (secret re-put, endpoint secret rotated, or set on a different Pages
  environment than production).

Fix, in order: copy the signing secret shown on this webhook in Resend →
`npx wrangler pages secret put RESEND_WEBHOOK_SECRET --project-name marc-portal` (production)
→ trigger a new deployment (Pages applies secret changes to new deployments) → re-enable the
webhook → « Replay » one failed event and expect 200 → replay the rest.

Follow-ups worth doing:
- **Alert on it.** Nothing in the portal noticed 8 days of 401s. The daily digest could flag
  « dernier événement Resend accepté il y a > 48 h ».
- **Log *why* a verify failed** (missing header / stale timestamp / no matching v1) in the 401
  body or Sentry, so the next mismatch is diagnosable from the dashboard alone.
- **Babillard's mail lands in the portal's webhook.** The failed payloads include
  `from: babillard@marcportal.com`, subject « Babillard — confirme ton courriel », to
  `delivered+walk-en-…@resend.dev` (an e2e/walkthrough address). One Resend account, one
  webhook: Babillard events will populate the portal's `email_events` and its suppression list
  (a Babillard bounce would silence portal mail to that person). Decide whether that's wanted,
  or filter by `from` domain/sender; and keep e2e sends off the production key.

## Ideas

- **Show a before/after for one shipped project** (« Truck notes : 40 min de facture le
  dimanche → 5 min ») — a number lands better than « du vrai code qui règle un vrai problème ».
- **A 30-second "is my idea a fit?" picker**: tap 3 chips (« pour moi / ma famille / ma
  business », « une fois / chaque semaine », « j'ai un budget / non ») → it names the likely
  tier. Turns the long tier list into a self-service answer without an account.
- **Testimonials or a one-line quote per shipped card** from whoever uses it (even a family
  member for Babillard).
- **The roman-numeral section counter (II / VIII)** is cute but cryptic to a stranger;
  a tiny label (« II · Projets ») on hover/focus would help.
- **Put the photo and « À propos » higher**: the human face is the trust signal, currently
  ~5 screens down on a 10 400 px tall phone page.

## Worked well

- Tone and honesty; the « Je fais pas » list sets expectations nicely.
- The 4-step process (« Je te réponds en 72 h », « pas d'IA entre toi et moi », démo dès la
  2e journée) is clear and reassuring.
- No horizontal overflow on phone; dark theme is readable; build hash in the footer.
