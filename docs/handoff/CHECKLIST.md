# Handoff Checklist — Marc Portal

> Internal mirror of the public `/handoff/checklist` page. The page is the
> source of truth for clients; this file is for Marc's offline reference and
> for clients who want a printable / non-JS version.
>
> **Public URL:** <https://marc-portal.pages.dev/handoff/checklist> (FR) /
> <https://marc-portal.pages.dev/en/handoff/checklist> (EN)

The page is layered for two audiences:

1. **The buyer** (a Quebec roofer / notary / accountant) reads sections 1–3
   in plain language and never sees a command.
2. **The next dev** (if the client ever migrates) opens the collapsed
   "Détails techniques" section at the bottom for asset-by-asset commands.

---

## 1. Le résumé en 5 étapes

1. **Tu reçois tous les identifiants.** Note partagée 1Password : repo, domaine, Cloudflare, Resend.
2. **Marc tague le commit final** : `git tag v1.0-handoff` — ton repère permanent dans le repo.
3. **Marc retire son accès partout.** GitHub, Cloudflare, Resend, registrar. Secrets sensibles régénérés en même temps.
4. **Tu reçois un courriel récap.** Un seul courriel, tous les liens, ta documentation officielle.
5. **Garantie de 90 jours.** Tout bug dans mon code, gratuit pendant 90 jours.

## 2. Mode « Je m'en occupe »

Les 5 étapes s'exécutent au moment du transfert (sur demande, n'importe quand) plutôt qu'à la livraison initiale. Entre-temps, Marc tient les comptes en dépositaire et gère renouvellements + sécurité. Transfert en ~1 semaine, sans frais.

## 3. Si Marc devient injoignable — kill-switch

**Seuil : 30 jours sans réponse.**

1. **GitHub Support** — fournir le courriel resté sans réponse + contrat. Transfert en ~30 jours.
2. **Cloudflare Support** — même procédure.
3. **Registrar du domaine** si différent de Cloudflare — même évidence.
4. **Régénérer les secrets** (§ Détails techniques ci-dessous) et redéployer.

Cette page reste publique à `/handoff/checklist`. Le client peut l'imprimer et la garder avec ses documents importants — pas besoin de demander à Marc.

---

## 4. Détails techniques (pour le prochain dev)

### Repo GitHub
- `git tag v1.0-handoff` sur le dernier commit déployé, push du tag.
- Mode « Tout à toi » : transfert de propriété (Settings → Transfer ownership) vers le compte du client. Client accepte sous 24 h.
- Mode « Je m'en occupe » : Marc reste propriétaire, client invité comme collaborateur en lecture.
- À la livraison effective : Marc retire son accès collaborateur (Settings → Collaborators).

### Domaine
- **Par défaut :** Cloudflare Registrar, au nom du client dès le début. Aucun transfert nécessaire à la livraison — Marc retire seulement son accès admin.
- **Cas alternatif** (domaine au nom de Marc) : Marc déclenche le transfert chez son registrar, fournit l'auth-code, le client accepte chez son registrar choisi (5-7 jours). Site reste en ligne.

### Hébergement Cloudflare Pages
- Mode « Tout à toi » : projet créé dans le compte Cloudflare du client dès le départ ; Marc invité au compte. À la livraison, Marc se retire (Account Home → Members).
- Mode « Je m'en occupe » → transfert ultérieur : option A — Settings → Move vers le compte du client ; option B — rebuild avec `npx wrangler pages deploy`.
- Variables d'environnement (SESSION_SECRET, RESEND_API_KEY) : régénérées au transfert.
- Vérif : `curl https://<domaine>/api/health` → `{ok:true}`.

### Base de données Cloudflare D1
- Export : `wrangler d1 export marc-portal-db --remote --output handoff.sql`.
- **Partage par défaut : fichier joint à une note 1Password partagée** (chiffré en transit + au repos par 1Password). Suffisant pour la grande majorité des projets.
- GPG-encryption avant partage : optionnel, à utiliser seulement si le projet contient des renseignements personnels sensibles. À discuter au cas par cas.
- Import client : `wrangler d1 create marc-portal-db` puis `wrangler d1 execute marc-portal-db --remote --file=handoff.sql`. Mettre à jour `database_id` dans `wrangler.toml`.

### Service de courriels Resend
- *Ne s'applique que si le projet envoie des courriels transactionnels.*
- Transfert : Settings → Team → Transfer ownership vers l'adresse du client.
- Client vérifie son domaine dans Resend (SPF, DKIM, DMARC).
- Marc révoque ses anciens API keys ; le client génère un nouveau `RESEND_API_KEY` et le met dans Cloudflare.

### Rotation des secrets
- `SESSION_SECRET` : `openssl rand -hex 32` (≥ 32 caractères).
- `RESEND_API_KEY` : généré par le client dans Resend après transfert.
- Marc supprime sa copie locale de tous les secrets et révoque ses jetons admin sur chaque service.

---

## Procédure post-handoff côté Marc

Après la livraison :

- [ ] Retirer le client du 1Password share.
- [ ] Archiver le dossier client (local + iCloud).
- [ ] Mettre à jour la `feature.json` de l'engagement à `shipped` avec une annotation `handed-off` (nom client + date).
- [ ] Mettre à jour le `userGuide` de la vitrine si applicable.
- [ ] Déplacer la session dans `/admin/trash` (soft-delete garde l'audit).
- [ ] Premier handoff : post-mortem dans `bmad/HANDOFF_RETRO_<client>.md`.

---

## Gabarit de courriel récap

```
Sujet : Récapitulatif de transfert — <projet>

Bonjour <prénom>,

Le transfert est complet. Voici tout ce que tu as maintenant en main :

REPO
  https://github.com/<toi>/<repo>
  Tag de livraison : v1.0-handoff

DOMAINE
  <domaine.com> — chez <registrar>, à ton nom
  Renouvellement : <date>

HÉBERGEMENT
  Cloudflare Pages : <ton compte>
  Projet : <slug>
  URL de santé : https://<domaine>/api/health

BASE DE DONNÉES
  Cloudflare D1 : <slug>
  Dernière sauvegarde : note 1Password partagée

COURRIELS (si applicable)
  Resend : ton compte
  Domaine vérifié : <domaine>

GARANTIE
  Tout bug dans mon code, gratuit pendant 90 jours (jusqu'au <date>).
  Après, c'est au tarif horaire et seulement si tu le demandes.

KILL-SWITCH
  Si je deviens injoignable, suis la procédure publiée à :
  https://marc-portal.pages.dev/handoff/checklist#dormance

Bonne suite,
Marc
```

---

**Source of truth :** `src/pages/HandoffChecklist.tsx`. Mettre à jour ce fichier en même temps lors de modifications.
