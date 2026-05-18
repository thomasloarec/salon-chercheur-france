## Plan corrigé — Radar CRM needs_review (v2)

Tous les points soulevés intégrés. Aucune action destructrice n'est faite à cette étape : ce plan attend ta validation explicite avant exécution.

Invariants :
- Matching par domaine inchangé.
- Import `42825220-…` non recréé.
- Crons (`radar-crm-rematch-cron`, dispatcher…), anti-doublon, quotas, `radar_email_log`, Resend, désabonnement : intacts.

---

## 1. Migration SQL (un seul fichier)

### 1.1 Extensions et colonnes

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA public;

ALTER TABLE public.crm_company_event_matches
  ADD COLUMN IF NOT EXISTS name_similarity numeric NULL,
  ADD COLUMN IF NOT EXISTS needs_review boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS review_reason text NULL;

CREATE INDEX IF NOT EXISTS idx_crm_matches_user_needs_review
  ON public.crm_company_event_matches(user_id, needs_review);

ALTER TABLE public.crm_imports
  ADD COLUMN IF NOT EXISTS suspicious_rate numeric NULL;
```

### 1.2 Fonctions de normalisation et de verdict (STABLE)

`crm_normalize_company_name(text)` — `STABLE` (et non `IMMUTABLE`, car `unaccent` est `STABLE`).
Lowercase, unaccent, retire ponctuation, retire formes juridiques : `sas, sarl, sasu, sa, ltd, llc, gmbh, group, groupe, inc, ag, bv, srl, spa, co, corp, holding, holdings`.

`crm_compute_match_review(crm_name, exhibitor_name)` — `STABLE`, retourne `(name_similarity, needs_review, review_reason)`.
Règle : `sim = max(similarity(a,b), containment_boost(0.6))`.
Seuil MVP : `sim < 0.35` → `needs_review=true, review_reason='crm_name_exhibitor_name_mismatch'`.
Cas dégénéré (un des deux noms vide) → `(null, false, null)` (pas de fausse alerte si donnée manquante).

### 1.3 `crm_run_matching` (mise à jour ciblée — domaine inchangé)

Différences vs version actuelle :

- Après l'INSERT/ON CONFLICT inchangé, exécute :
  ```sql
  UPDATE public.crm_company_event_matches m
  SET name_similarity = r.name_similarity,
      needs_review    = r.needs_review,
      review_reason   = r.review_reason
  FROM public.crm_companies c, public.exposants ex,
       LATERAL public.crm_compute_match_review(c.company_name, ex.nom_exposant) r
  WHERE m.crm_company_id = c.id
    AND ex.id_exposant   = m.id_exposant   -- ✅ pas de cross join
    AND c.import_id      = p_import_id;
  ```
- Calcule `suspicious_rate` de l'import et l'écrit :
  ```sql
  UPDATE crm_imports
  SET suspicious_rate = CASE
    WHEN total_matches = 0 THEN 0      -- pas de match → 0
    ELSE flagged::numeric / total_matches::numeric
  END
  WHERE id = p_import_id;
  ```
- `newMatches` retourné enrichi par requête finale sur les matches de l'import :
  ```
  match_id, crm_company_id, crm_company_name, id_exposant, nom_exposant,
  event_id, nom_event, normalized_domain,
  name_similarity, needs_review, review_reason, is_future_event
  ```
- Ajoute `needsReviewCount` et `suspiciousRate` au JSON retourné.
- Permissions inchangées : service_role only.

### 1.4 Backfill — `crm_backfill_match_review()`

Retourne :
```json
{
  "processedMatches": N,
  "flaggedMatches": N,
  "processedImports": N,
  "suspiciousImports": N
}
```

Étapes :
1. UPDATE des matches existants (jointure directe `ex.id_exposant = m.id_exposant`, pas de cross join).
2. UPDATE de `crm_imports.suspicious_rate` pour chaque import ayant des matches :
   ```sql
   UPDATE crm_imports i SET suspicious_rate = s.rate
   FROM (
     SELECT c.import_id,
            COUNT(*) AS total,
            COUNT(*) FILTER (WHERE m.needs_review) AS flagged,
            CASE WHEN COUNT(*) = 0 THEN 0
                 ELSE COUNT(*) FILTER (WHERE m.needs_review)::numeric / COUNT(*) END AS rate
     FROM crm_company_event_matches m
     JOIN crm_companies c ON c.id = m.crm_company_id
     WHERE c.import_id IS NOT NULL
     GROUP BY c.import_id
   ) s
   WHERE i.id = s.import_id;
   ```
   → Note : les imports sans aucun match conservent `suspicious_rate IS NULL` (documenté : "non calculable, aucun match").
3. Exécuté **une fois** dans la migration : `SELECT public.crm_backfill_match_review();`.
4. Restreint à `service_role`.

### 1.5 `get_radar_crm_admin_stats`

Ajoute, sans casser les champs existants :
- `needsReviewMatches` : count des matches `needs_review=true`.
- `suspiciousImports` : count d'imports `completed` avec `suspicious_rate > 0.30`.
- `recentSuspiciousImports` : top 20 (id, email, file_name, total_rows, suspicious_rate, created_at).
- `suspicious_rate` ajouté à chaque ligne de `recentImports`.

---

## 2. Edge functions

### 2.1 `radar-crm-rematch-cron`

À l'endroit où il crée les notifications Radar CRM à partir de `newMatches` :
- **Filtrer** : ignorer tout match dont `needs_review === true` lors de la création de notifications "standard" (`type='radar_new_matches'`).
- Conserver tout le reste (anti-doublon, group_key, quotas, idempotence).

Recommandation MVP retenue : **pas de notification automatique** pour les matches suspects. L'utilisateur les verra dans `/radar-crm/results` avec le badge "Correspondance à vérifier".

(Note : si on souhaite plus tard créer une notification "review", on ajoutera un type distinct `radar_match_needs_review` exclu côté dispatcher. Pas dans ce MVP.)

### 2.2 `radar-crm-email-dispatcher`

Double sécurité :

1. **Côté notification** : `metadata.needsReview === true` → exclu (au cas où des notifs marquées seraient créées par un autre flux).
2. **Côté match** : après avoir résolu les `companies[].crmCompanyId` et `id_exposant` d'une notif, rejoindre `crm_company_event_matches` et exclure le groupe si **tous** ses matches sont `needs_review=true`. Si seulement certains, filtrer ces lignes individuelles (rare en pratique).

Affichage email (tous les matches inclus, par définition non-suspects) :
- Titre principal d'une chip = **`exposants.nom_exposant`** (récupéré via jointure sur `id_exposant`).
- Sous-texte (si nom CRM ≠ nom exposant normalisés) :
  `Correspond à votre fiche CRM : {crm_companies.company_name}`
- Favicons : inchangés (basés sur `normalized_domain`).
- Subject line : utilise `nom_exposant` au lieu de `companyName`.
- Anti-doublon, quotas, `radar_email_log`, `resend_message_id`, désabonnement, template mobile : intacts.

### 2.3 `crm-import`

Après `crm_run_matching` :
- Lit `suspiciousRate` et `needsReviewCount` du retour de la RPC.
- Renvoie au front : `qualityWarning: { rate, threshold: 0.30, suspicious: rate > 0.30, needsReviewCount }`.
- Le calcul de `suspicious_rate` est fait par la RPC SQL (étape 1.3), pas en TS — single source of truth.

---

## 3. Front

### 3.1 `RadarCrmResults.tsx`

- Étendre la requête `crm_company_event_matches` pour récupérer `needs_review, review_reason, name_similarity`.
- Étendre la `viewMap` (déjà jointe sur `crm_radar_participations_view`) : `nom_exposant` y est déjà disponible.
- Carte / chip entreprise :
  - **Titre** = `viewRow.nom_exposant` (vrai exposant).
  - Sous-texte (si normalisations différentes) :
    `Correspond à votre fiche CRM : {company.company_name}`
  - Si `needs_review` :
    - Badge orange `Correspondance à vérifier`.
    - Tooltip : `Le domaine correspond, mais le nom de votre fiche CRM diffère fortement du nom exposant.`
- `onOpenExhibitor` : passe `nom_exposant` réel au popup ; si match suspect, ajoute `crmCompanyName` + `needsReview` dans le payload.
- Bannière qualité après import : si la réponse de `crm-import` contient `qualityWarning.suspicious=true`, afficher un encart orange non bloquant en haut des résultats :
  > Certaines lignes de votre fichier semblent associer une entreprise à un site web incohérent. Vérifiez que vos colonnes n'ont pas été triées séparément dans Excel.

### 3.2 `ExhibitorDetailDialog`

Si `exhibitor.crmCompanyName` + `exhibitor.needsReview` sont fournis :
- Le titre reste le vrai nom exposant.
- Encart discret en bas : `Correspondance CRM à vérifier : {crmCompanyName}`.

### 3.3 `AdminRadarCrm.tsx`

- 2 nouvelles cards stats : `Matches à vérifier`, `Imports suspects`.
- Nouvelle colonne `suspicious_rate` dans le tableau "Derniers imports" (% si non null, "—" sinon).
- Nouveau tableau "Imports suspects récents" (à partir de `recentSuspiciousImports`).

---

## 4. Logique exacte

### needs_review
```
sim = max(
  pg_trgm.similarity(normalize(crm_name), normalize(exhibitor_name)),
  position_contains(a,b) ? 0.6 : 0
)
needs_review = (sim < 0.35) AND (a != '' AND b != '')
review_reason = needs_review ? 'crm_name_exhibitor_name_mismatch' : null
```

### suspicious_rate (par import)
```
total = COUNT(matches de l'import)
flagged = COUNT(matches needs_review=true de l'import)
suspicious_rate = total == 0 ? NULL : flagged / total
import.suspicious = suspicious_rate > 0.30
```
Calculé en SQL dans `crm_run_matching` (post-matching) et dans `crm_backfill_match_review` (rétro).

---

## 5. Impacts résumés

| Domaine | Impact |
|---|---|
| Matching domaine | Inchangé |
| Notifications internes | Matches `needs_review=true` ne créent plus de notif auto |
| Emails auto | Double filtre : metadata + jointure matches ; titre = vrai exposant |
| UI résultats | Vrai exposant en titre, nom CRM en secondaire, badge "À vérifier" |
| Popup exposant | Encart "Correspondance CRM à vérifier" si applicable |
| Admin | 2 stats + colonne suspicious_rate + tableau imports suspects |
| Quotas / désabonnement / Resend / crons | Intacts |

---

## 6. Fichiers attendus

- `supabase/migrations/<ts>_radar_crm_needs_review_v2.sql` (tout le SQL ci-dessus + backfill exécuté).
- `supabase/functions/radar-crm-rematch-cron/index.ts` (filtre needs_review avant création notif).
- `supabase/functions/radar-crm-email-dispatcher/index.ts` (double filtre, titre = nom_exposant, sous-texte CRM).
- `supabase/functions/crm-import/index.ts` (renvoie `qualityWarning`).
- `src/pages/RadarCrmResults.tsx` (fetch des nouveaux champs, badges, bannière qualité).
- `src/components/event/ExhibitorDetailDialog.tsx` (encart "à vérifier").
- `src/pages/RadarCrm.tsx` (transmet `qualityWarning` à la page de résultats si import direct).
- `src/pages/admin/AdminRadarCrm.tsx` (cards + tableau).

---

## Question avant exécution

1. **Seuil 0.35** OK ? (option : 0.30 plus permissif, 0.50 plus strict)
2. **Seuil suspicious_rate 30 %** OK pour qualifier un import comme suspect ?
3. Confirmation : tu veux **aucune** notification interne automatique pour les matches `needs_review=true` (option MVP retenue), plutôt que des notifications avec badge ?

Dès validation, j'exécute la migration puis les modifications de code dans la foulée.
