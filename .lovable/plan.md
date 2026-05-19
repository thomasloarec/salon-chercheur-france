## Phase E — Activation contrôlée du cron SEO + visibilité scores faibles

### Audit live (à partir des 209 events futurs visibles)

| Catégorie | Définition | Volume |
|---|---|---|
| A. Éligibles cron | score ≥ 55 ET (desc_enrichie NULL OU statut≠valide) | **1** |
| Score ≥ 55 déjà `valide` | rien à faire | 111 |
| B. Score moyen 35–54 | non traité auto | **97** |
| C. Score < 35 | ignoré par défaut | **0** |
| Score NULL | aucun | 0 |

Aucun cron SEO n'existe actuellement (`cron.job` vide côté SEO). La fonction `seo-enrichment-batch` filtre déjà en mode `run` sur score ≥ 55, gate Vercel sur `public_changed`, et libère les runs orphelins après 10 min. Aucune logique métier à modifier dans le batch.

---

### 1. Migration BD

Ajouter un drapeau `enrichissement_ignored boolean default false` à `events` pour permettre "Ignorer" un event score moyen/faible.

Ajouter une fonction `public.start_seo_cron_run()` (SECURITY DEFINER, owner postgres) appelée par pg_cron, qui :

- vérifie qu'aucun run `running` n'a démarré depuis < 2 h ; sinon log et sort ;
- fait un `net.http_post` vers `seo-enrichment-batch` avec headers `apikey` (anon), `x-seo-batch-secret` (lu depuis `vault` ou variable de session admin), body `{"mode":"run","limit":20,"deploy":true,"trigger_source":"cron"}` ;
- log dans `seo_enrichment_runs.details` côté fonction batch (déjà fait).

Le secret `SEO_BATCH_SECRET` côté pg_cron sera passé via `cron.schedule` créé par **outil `insert`** (pas migration) car contient secret + URL projet — instruction explicite du système.

Filtre cron mis à jour côté fonction batch : ajouter `AND coalesce(enrichissement_ignored,false)=false` dans la sélection des éligibles (4 lignes dans `seo-enrichment-batch/index.ts`).

### 2. Edge function `seo-recompute-score`

Petite fonction admin-gated qui appelle la RPC existante `compute_event_enrichissement_score(uuid)` pour un event et renvoie le nouveau score. Branchée sur bouton "Recalculer score".

### 3. Dashboard `SeoEnrichmentDashboard.tsx`

#### Nouvelles catégories KPI (en haut)
- **Éligibles cron** (A) — score ≥ 55 + desc manquante/non valide + non ignoré
- **À vérifier manuellement** (D) — desc générée ET (auto_val warning/failed OU validation_mode=manual OU statut=en_attente). Exclut explicitement les events sans desc générée.
- **Non traités auto** (B+C+ignorés) — chiffre global cliquable qui déplie la section ci-dessous.

#### Section repliable "Événements non traités automatiquement"
3 sous-compteurs (35–54, <35, NULL) + table compacte par défaut limitée aux 20 premiers, avec colonnes : nom, slug, date, ville, score, raison (`Score moyen` / `Score faible` / `Données insuffisantes` / `Ignoré manuellement`). Actions par ligne :
- "Voir événement" → ouvre page admin event
- "Recalculer score" → appelle `seo-recompute-score`
- "Ignorer" / "Réactiver" → toggle `enrichissement_ignored`
- "Forcer enrichissement test" (admin only) → ouvre AlertDialog de confirmation forte, puis appelle `seo-enrichment-batch` avec event ciblé en `mode:test`. Garde-fou : refuse si score < 20.

#### Bloc "Cron SEO automatique"
- Badge **Cron actif** / **Cron inactif** lu depuis `cron.job` via RPC `get_seo_cron_status()` (à créer, SECURITY DEFINER, restreinte admin).
- Affiche : nom (`seo-enrichment-nightly`), schedule (`30 1 * * *` UTC ≈ 02:30/03:30 Paris selon DST), payload, dernière exécution cron, prochaine exécution estimée.
- Bouton "Désactiver le cron" → RPC `disable_seo_cron()` (admin only) qui fait `UPDATE cron.job SET active=false`.
- Bouton "Activer le cron" si inactif → RPC `enable_seo_cron()`.
- Instructions claires : "Pour supprimer définitivement, voir SQL Editor : `SELECT cron.unschedule('seo-enrichment-nightly');`"

#### Test pré-cron
Bouton "Test final (limit=5, trigger=manual, deploy=true)" qui réutilise le proxy admin existant. Affiche le résultat dans la carte "Dernier résultat".

### 4. Création du cron job

Via l'outil **insert** (pas migration), une fois la fonction `start_seo_cron_run` créée :

```sql
SELECT cron.schedule(
  'seo-enrichment-nightly',
  '30 1 * * *',  -- 01:30 UTC = 02:30 (hiver) / 03:30 (été) Paris
  $$SELECT public.start_seo_cron_run();$$
);
```

Idempotent : avant insertion, `SELECT cron.unschedule('seo-enrichment-nightly')` si déjà présent.

`start_seo_cron_run` lit `SEO_BATCH_SECRET` depuis `vault.decrypted_secrets` (à insérer via outil insert également). URL fonction et anon key inline (project-specific, OK selon doc cron).

### 5. Confirmations explicites (réponse finale à l'utilisateur)

À la fin, je fournirai :
- les 3 chiffres (score < 55 total, 35–54, < 35, NULL) ;
- confirmation que le cron filtre sur score ≥ 55 + non ignoré ;
- où trouver les non-traités dans le dashboard ;
- comment forcer un traitement manuel ou désactiver le cron.

---

### Fichiers

**Créés**
- `supabase/functions/seo-recompute-score/index.ts` — admin-gated RPC wrapper
- migration SQL (colonne `enrichissement_ignored`, fonction `start_seo_cron_run`, RPC `get_seo_cron_status` / `enable_seo_cron` / `disable_seo_cron`)

**Modifiés**
- `supabase/functions/seo-enrichment-batch/index.ts` — ajout filtre `enrichissement_ignored`
- `supabase/functions/admin-seo-batch-proxy/index.ts` — ajout `seo-recompute-score` à l'allowlist
- `src/components/admin/SeoEnrichmentDashboard.tsx` — nouvelles catégories + section repliable + bloc cron + test final

**Non modifié**
- Logique de scoring, d'enrichissement, d'auto-validation et de Vercel deploy.

### Ordre d'exécution

1. Migration SQL (colonne + RPCs cron) — **demande approbation utilisateur**.
2. Insertion `SEO_BATCH_SECRET` dans vault + `cron.schedule` via outil insert — **demande approbation utilisateur**.
3. Edge functions (recompute + filter ignored).
4. Refonte dashboard.
5. Bouton "Test final 5" → utilisateur lance, vérifie OK.
6. Bouton "Activer cron" → utilisateur active.

### Hors scope

- Pas de modification de la fonction de scoring.
- Pas d'enrichissement IA des events score < 55.
- Pas d'archivage automatique des events score faible.
