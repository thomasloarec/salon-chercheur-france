## Plan V3 — Radar CRM needs_review (corrections SQL avant migration)

Invariants : matching domaine inchangé ; import `42825220-…` non recréé ; aucun cron supprimé ; quotas / `radar_email_log` / Resend / désabonnement / template mobile intacts.

---

## 1. Migration SQL (corrigée)

### 1.1 Extensions + colonnes
Inchangé vs V2 (`pg_trgm`, `unaccent`, `name_similarity`, `needs_review`, `review_reason`, index `(user_id, needs_review)`, `crm_imports.suspicious_rate`).

### 1.2 `crm_normalize_company_name` / `crm_compute_match_review`
`STABLE`. Logique inchangée vs V2 :
- normalisation : lowercase, unaccent, suppression ponctuation + formes juridiques.
- `sim = max(similarity(a,b), contained ? 0.6 : 0)`.
- Seuil `< 0.35` ⇒ `needs_review=true`, `review_reason='crm_name_exhibitor_name_mismatch'`.
- Si un nom normalisé est NULL : `(NULL, false, NULL)`.

### 1.3 `crm_run_matching` — **correctifs majeurs**

a) **Capture explicite des IDs insérés** (point 2 du user) :

```sql
DECLARE
  v_inserted_match_ids uuid[] := ARRAY[]::uuid[];
BEGIN
  WITH inserted AS (
    INSERT INTO public.crm_company_event_matches (...)
    SELECT ... FROM public.crm_companies c
    JOIN public.crm_radar_participations_view r ON ...
    WHERE c.import_id = p_import_id AND c.user_id = p_user_id
    ON CONFLICT (crm_company_id, id_exposant, event_id) DO NOTHING
    RETURNING id
  )
  SELECT COALESCE(array_agg(id), ARRAY[]::uuid[])
  INTO v_inserted_match_ids
  FROM inserted;
```

b) **UPDATE sécurisé via sous-requête** (point 1 du user) — la table cible `m` n'est jamais référencée dans un JOIN :

```sql
UPDATE public.crm_company_event_matches m
SET name_similarity = s.name_similarity,
    needs_review    = s.needs_review,
    review_reason   = s.review_reason
FROM (
  SELECT
    m2.id AS match_id,
    r.name_similarity,
    r.needs_review,
    r.review_reason
  FROM public.crm_company_event_matches m2
  JOIN public.crm_companies c   ON c.id = m2.crm_company_id
  JOIN public.exposants ex      ON ex.id_exposant = m2.id_exposant
  CROSS JOIN LATERAL public.crm_compute_match_review(c.company_name, ex.nom_exposant) r
  WHERE c.import_id = p_import_id
) s
WHERE m.id = s.match_id;
```

c) **`suspicious_rate` de l'import** calculé/persisté :
```sql
SELECT count(*), count(*) FILTER (WHERE m.needs_review)
INTO v_total, v_flagged
FROM crm_company_event_matches m
JOIN crm_companies c ON c.id = m.crm_company_id
WHERE c.import_id = p_import_id;

v_suspicious_rate := CASE WHEN v_total = 0 THEN NULL
                          ELSE round(v_flagged::numeric / v_total, 4) END;

UPDATE crm_imports SET suspicious_rate = v_suspicious_rate, updated_at = now()
WHERE id = p_import_id;
```
→ Pas de match ⇒ `NULL` (documenté : « non calculable, aucun match »).

d) **`newMatches` basé sur `v_inserted_match_ids`** (point 2/3 du user) :

```sql
SELECT COALESCE(jsonb_agg(to_jsonb(d)
         ORDER BY (d.is_future_event)::int DESC), '[]'::jsonb)
INTO v_new_matches
FROM (
  SELECT
    m.id AS match_id, m.crm_company_id,
    c.company_name AS crm_company_name, c.import_id,
    m.id_exposant, ex.nom_exposant,
    m.event_id, e.nom_event,
    m.normalized_domain,
    m.name_similarity, m.needs_review, m.review_reason,
    (e.date_debut >= CURRENT_DATE) AS is_future_event
  FROM public.crm_company_event_matches m
  JOIN public.crm_companies c ON c.id = m.crm_company_id
  LEFT JOIN public.exposants ex ON ex.id_exposant = m.id_exposant
  LEFT JOIN public.events e ON e.id = m.event_id
  WHERE m.id = ANY(v_inserted_match_ids)
) d;
```

e) **Retour JSON** : tous les champs V2 + `needsReviewCount` + `suspiciousRate`.
f) Permissions : `service_role` only.

### 1.4 `crm_backfill_match_review()` — même pattern de sous-requête

```sql
WITH upd AS (
  UPDATE public.crm_company_event_matches m
  SET name_similarity = s.name_similarity,
      needs_review    = s.needs_review,
      review_reason   = s.review_reason
  FROM (
    SELECT m2.id AS match_id, r.name_similarity, r.needs_review, r.review_reason
    FROM public.crm_company_event_matches m2
    JOIN public.crm_companies c ON c.id = m2.crm_company_id
    JOIN public.exposants ex   ON ex.id_exposant = m2.id_exposant
    CROSS JOIN LATERAL public.crm_compute_match_review(c.company_name, ex.nom_exposant) r
  ) s
  WHERE m.id = s.match_id
  RETURNING m.id, m.needs_review
)
SELECT count(*), count(*) FILTER (WHERE needs_review)
INTO v_processed_matches, v_flagged_matches FROM upd;
```

Puis `UPDATE crm_imports` via sous-requête `per_import` (count/flagged par `import_id`).
Retour : `{ processedMatches, flaggedMatches, processedImports, suspiciousImports }`.
Exécution unique : `SELECT public.crm_backfill_match_review();` à la fin de la migration.
Permissions : `service_role` only.

### 1.5 `get_radar_crm_admin_stats()`
Ajout (sans casser l'existant) : `needsReviewMatches`, `suspiciousImports`, `recentSuspiciousImports[]`, et colonne `suspicious_rate` dans `recentImports[]`. `SECURITY DEFINER`, vérif `is_admin()`.

---

## 2. Edge function `radar-crm-rematch-cron`

À la création des notifications standard (`type='radar_new_matches'`, ligne ~270 / ~480) :
- **Filtrer en amont** : `futureMatches = newMatches.filter(m => m.is_future_event === true && m.needs_review !== true)`.
- Idem dans la branche `RECONCILIATION` : enrichir la requête `crm_company_event_matches` avec `needs_review` et exclure `needs_review=true` du `groupedByEvent`.
- Compteur `skippedNeedsReviewMatches` ajouté au `summary`.
- Anti-doublon, `group_key`, idempotence, ensure_radar_access : intacts.

MVP : **pas de notification automatique** pour `needs_review=true`. Visibles uniquement dans l'UI.

## 3. Edge function `radar-crm-email-dispatcher`

Double sécurité :
1. **Niveau notification** : skip si `metadata.needsReview === true`.
2. **Niveau match** : pour chaque notif candidate, charger `crm_company_event_matches` correspondant aux `(crmCompanyId, idExposant, eventId)` et filtrer les lignes où `needs_review=true`. Si plus aucune ligne, skip la notif.

Affichage chip (matches restants, donc non-suspects par construction) :
- Titre = `exposants.nom_exposant` (jointure via `id_exposant`).
- Sous-texte si normalisations différentes : `Correspond à votre fiche CRM : {crm_companies.company_name}`.
- Subject : utilise `nom_exposant`.
- Quotas, `radar_email_log`, `resend_message_id`, désabonnement, Resend, template mobile : **intacts**.

## 4. Edge function `crm-import`
Renvoie au front `qualityWarning: { rate, threshold: 0.30, suspicious: rate > 0.30, needsReviewCount }` lu depuis le retour de `crm_run_matching` (single source of truth SQL).

---

## 5. Front

### `src/pages/RadarCrmResults.tsx`
- Étendre la requête `crm_company_event_matches` : ajouter `needs_review, review_reason, name_similarity`.
- Titre carte/chip = `viewRow.nom_exposant` (vrai exposant).
- Sous-texte (si différent) : `Correspond à votre fiche CRM : {company.company_name}`.
- Si `needs_review` : badge orange `Correspondance à vérifier` + tooltip `Le domaine correspond, mais le nom de votre fiche CRM diffère fortement du nom exposant.`
- Bannière qualité (si `qualityWarning.suspicious=true`) en haut, orange non bloquant.
- `onOpenExhibitor` : passe `nom_exposant`, `crmCompanyName`, `needsReview` au popup.

### `src/components/event/ExhibitorDetailDialog.tsx`
Si `exhibitor.needsReview` + `exhibitor.crmCompanyName` : encart bas `Correspondance CRM à vérifier : {crmCompanyName}`. Titre principal inchangé (vrai exposant).

### `src/pages/admin/AdminRadarCrm.tsx`
- 2 cards : `Matches à vérifier`, `Imports suspects`.
- Colonne `suspicious_rate` dans le tableau « Derniers imports » (`%` ou `—`).
- Nouveau tableau `Imports suspects récents` à partir de `recentSuspiciousImports`.

---

## 6. Logique exacte (verrouillée)

**needs_review**
```
a = normalize(crm_name); b = normalize(exhibitor_name)
sim = max(similarity(a,b), (position(a in b)>0 OR position(b in a)>0 ? 0.6 : 0))
needs_review = a IS NOT NULL AND b IS NOT NULL AND sim < 0.35
review_reason = needs_review ? 'crm_name_exhibitor_name_mismatch' : NULL
```

**suspicious_rate (par import)**
```
total   = COUNT(matches de l'import)
flagged = COUNT(matches needs_review=true de l'import)
suspicious_rate = total = 0 ? NULL : flagged / total   (round 4 décimales)
import.suspicious = suspicious_rate > 0.30
```

---

## 7. Impacts

| Domaine | État |
|---|---|
| Matching domaine | **Inchangé** |
| Notifications internes auto | `needs_review=true` ⇒ pas de notif |
| Emails auto | Double filtre (metadata + jointure matches) ; titre = vrai exposant ; `needs_review` exclus |
| UI `/radar-crm/results` | Vrai exposant en titre, nom CRM en secondaire, badge « À vérifier », bannière qualité |
| Popup exposant | Encart « Correspondance CRM à vérifier » si applicable |
| Admin | 2 stats + colonne + tableau, stats existantes préservées |
| Crons | **Aucun supprimé**, contenu enrichi uniquement |
| Quotas / désabonnement / Resend / `radar_email_log` | **Intacts** |

---

## 8. Tests post-exécution

- **A** Import propre : ~0 needs_review ; emails OK.
- **B** Import corrompu (`Airbus|oxypharm.net`, `Toshiba|renaultgroup.com`) : match domaine créé, `needs_review=true`, UI affiche OXY'PHARM en titre + « Correspond à votre fiche CRM : Airbus… », badge orange, **exclu des emails**.
- **C** `curl_edge_functions` dispatcher en dry-run : aucun match `needs_review` dans le payload.
- **D** SQL : migration passe (pas d'erreur `m` dans JOIN), `newMatches` basé sur `v_inserted_match_ids` (jamais `created_at >= now() - interval`).

---

## 9. Fichiers touchés

- `supabase/migrations/<ts>_radar_crm_needs_review_v3.sql`
- `supabase/functions/radar-crm-rematch-cron/index.ts`
- `supabase/functions/radar-crm-email-dispatcher/index.ts`
- `supabase/functions/crm-import/index.ts`
- `src/pages/RadarCrmResults.tsx`
- `src/pages/RadarCrm.tsx` (passe `qualityWarning` aux résultats si import direct)
- `src/components/event/ExhibitorDetailDialog.tsx`
- `src/pages/admin/AdminRadarCrm.tsx`

---

## Validation requise

Réponds simplement **« go V3 »** (ou indique seuils différents) et j'exécute dans l'ordre :
1. migration SQL → 2. dispatcher + cron + crm-import → 3. UI résultats + popup + admin → 4. tests B/C/D.
