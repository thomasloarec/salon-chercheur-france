## Objectif

Corriger durablement Radar CRM pour qu'un fichier CRM désaligné (company_name ≠ domaine) ne génère plus jamais d'affichage ou d'email trompeur. Le matching par domaine reste la clé principale, mais on ajoute un garde-fou "needs_review" + on affiche systématiquement le **vrai nom exposant** comme nom principal.

## Principes invariants

- Matching domaine inchangé (clé principale).
- Parsing CSV/Excel inchangé (sauf ajout de contrôles qualité non bloquants).
- Crons, Stripe, paywall, trial, désabonnement, anti-doublon : non touchés.
- L'import `42825220-…` est déjà supprimé : aucune action sur lui.

---

## 1. Migration SQL

**Nouvelle migration** ajoutant à `crm_company_event_matches` :

```sql
ALTER TABLE crm_company_event_matches
  ADD COLUMN name_similarity numeric NULL,
  ADD COLUMN needs_review boolean NOT NULL DEFAULT false,
  ADD COLUMN review_reason text NULL;

CREATE INDEX idx_crm_matches_needs_review
  ON crm_company_event_matches(user_id, needs_review);
```

**Fonctions SQL** (search_path = public, security definer où nécessaire) :

- `crm_normalize_company_name(text) returns text`
  → lowercase, unaccent, retire ponctuation, retire formes juridiques (sas, sarl, sa, sasu, ltd, llc, gmbh, group, groupe, inc, ag, bv, srl, spa, co, corp).
- `crm_name_similarity(a text, b text) returns numeric`
  → utilise `pg_trgm.similarity` sur les noms normalisés (0..1). Active extension `pg_trgm` si absent.
- `crm_compute_match_review(crm_name text, exhibitor_name text) returns table(name_similarity numeric, needs_review boolean, review_reason text)`
  → seuil MVP : similarity < 0.35 → needs_review=true, reason='crm_name_exhibitor_name_mismatch'.
- `crm_backfill_match_review() returns jsonb`
  → recalcule tous les matches existants en joignant `crm_companies` et `exposants` via `id_exposant`. Retourne `{ processed, flagged }`.

**Modification de `crm_run_matching`** : à la fin de la procédure de matching existante, calcule et écrit `name_similarity`, `needs_review`, `review_reason` pour les matches du nouvel import. (On lit le code de la fonction actuelle d'abord et on ne change QUE l'ajout des 3 colonnes, sans toucher la logique domaine.)

---

## 2. Edge function `radar-crm-email-dispatcher`

- Filtrer la requête de matches : `WHERE needs_review = false`.
- Pour les matches inclus, joindre `exposants.nom_exposant` et l'utiliser comme **titre principal** dans le HTML.
- Ajouter sous le titre (si nom CRM ≠ nom exposant) :
  `<div class="muted">Correspond à votre fiche CRM : {company_name}</div>`
- Favicons : inchangés (basés sur le domaine).
- Anti-doublon, quotas, `radar_email_log`, `resend_message_id`, unsubscribe : non touchés.

---

## 3. UI Radar CRM (`/radar-crm/results`)

Fichiers concernés (à confirmer après lecture) : composants de cartes/chips dans `src/components/radar-crm/` + hook `useCrmMatches`.

- Le hook expose désormais `nom_exposant` (depuis `crm_radar_participations_view` ou jointure `exposants`), `needs_review`, `review_reason`, `name_similarity`, et `crm_company_name`.
- Carte de match :
  - **Titre** = `nom_exposant` (vrai exposant).
  - Sous-texte = `Correspond à votre fiche CRM : {crm_company_name}` (uniquement si différent).
  - Si `needs_review=true` : badge orange `Correspondance à vérifier` + tooltip "Le domaine correspond, mais le nom de votre fiche CRM diffère fortement du nom exposant."

---

## 4. Popup exposant

Quand le popup est ouvert depuis un match Radar CRM avec `needs_review=true`, afficher en bas un encart discret :
`Correspondance CRM à vérifier : {crm_company_name}`.
Le titre du popup reste le vrai nom exposant.

---

## 5. Contrôle qualité post-import

Dans `supabase/functions/crm-import/index.ts`, après matching :

- Pour chaque ligne `crm_companies` insérée, extraire le radical du domaine (`normalized_domain` sans TLD) et tester sa présence dans `crm_normalize_company_name(company_name)`.
- Calculer `incoherenceRate = lignesIncoherentes / lignesAvecDomaine`.
- Renvoyer ce champ dans la réponse JSON (`qualityWarning: { rate, threshold: 0.3, suspicious: rate > 0.3 }`).
- L'UI d'import (page `RadarCrm.tsx` ou composant de résultats d'import) affiche un toast/banner orange si `suspicious=true` :
  > "Certaines lignes de votre fichier semblent associer une entreprise à un site web incohérent. Vérifiez que vos colonnes n'ont pas été triées séparément dans Excel."

Non bloquant.

---

## 6. Admin Radar CRM (`AdminRadarCrm.tsx` + RPC `get_radar_crm_admin_stats`)

Ajouter au RPC SQL :
- `needsReviewMatches` : count où `needs_review=true`.
- `suspiciousImports` : imports completed dont >30% de lignes incohérentes (calcul à la volée ou colonne dédiée `crm_imports.suspicious_rate` à ajouter).
- `recentSuspiciousImports` : top 10.

Affichage : 2 nouvelles cards + un petit tableau "Imports suspects récents".

> Note : pour éviter un calcul SQL lourd à chaque appel, on ajoute `suspicious_rate numeric NULL` à `crm_imports` et on l'écrit depuis l'edge function `crm-import` à la fin du traitement.

---

## 7. Backfill

Appel SQL one-shot exécuté via la migration (à la fin) :
```sql
SELECT crm_backfill_match_review();
```
Affecte uniquement les matches existants (l'import corrompu est déjà supprimé).

---

## 8. Notifications internes

Vérifier `notifications-create` / le flux Radar CRM :
- Si un match `needs_review=true` doit créer une notif interne : ajouter `metadata.needsReview=true` et `metadata.crmCompanyName`.
- L'UI Notifications affiche le badge "Correspondance à vérifier".
- Le dispatcher email ignore déjà ces matches (étape 2).

Anti-doublon par `group_key` : audit lecture seule, documenté dans le rapport final. Pas de changement destructif.

---

## 9. Tests

Ajouter `src/utils/__tests__/crmNameSimilarity.test.ts` (côté front, miroir JS de la normalisation pour les tooltips) couvrant :
- "Airbus Defense and Space Toulouse" vs "OXY'PHARM" → faible similarité.
- "Renault Group" vs "RENAULT SAS" → forte similarité.
- "Toshiba" vs "Renault Group" → faible similarité.

Tests SQL : insérer 2 lignes de test (Test B du brief) dans un import jetable lors d'une vérification manuelle, mais **pas committé** car cela créerait des données.

---

## 10. Fichiers attendus

- `supabase/migrations/<ts>_radar_crm_needs_review.sql` (nouvelles colonnes + fonctions + backfill + extension pg_trgm + colonne `suspicious_rate` sur `crm_imports` + mise à jour `get_radar_crm_admin_stats` + mise à jour `crm_run_matching`).
- `supabase/functions/crm-import/index.ts` (calcul qualité, écriture `suspicious_rate`).
- `supabase/functions/radar-crm-email-dispatcher/index.ts` (filtre needs_review, titre = vrai exposant).
- `src/hooks/useCrmMatches.ts` (expose les nouveaux champs).
- `src/components/radar-crm/*` (titre = vrai exposant, sous-texte CRM, badge "À vérifier").
- `src/pages/RadarCrm.tsx` / résultats d'import (banner qualité).
- `src/pages/admin/AdminRadarCrm.tsx` (nouvelles cards + tableau).
- `src/utils/crmNameSimilarity.ts` (+ tests).

---

## Critères de réussite

- Matching domaine inchangé.
- `needs_review=true` exclu des emails automatiques.
- UI/email affichent toujours le vrai nom exposant en titre.
- Backfill exécuté, l'import déjà supprimé non recréé.
- Cron, anti-doublon, quotas, désabonnement intacts.

---

## Question avant exécution

Le seuil de similarité MVP proposé est **0.35** (échelle pg_trgm 0..1). Ok pour ce seuil, ou préfères-tu plus strict (0.5) / plus permissif (0.25) ?
