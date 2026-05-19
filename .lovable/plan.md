## Objectif

Remplacer la logique "cron nocturne" par :
- traitement **post-import** (déclenché manuellement depuis l'admin après chaque import mensuel) ;
- **anti-retraitement Claude** par hash de la source ;
- **visibilité** sur la consommation Claude potentielle avant tout lancement ;
- **aucun cron actif** créé maintenant (préparation uniquement pour un éventuel rattrapage hebdomadaire futur).

Aucun appel à Claude, aucun build Vercel, aucun job pg_cron ne sera créé par cette étape.

---

## Migration 1 — Anti-retraitement par hash + flag ignored étendu

Fichier : nouvelle migration SQL.

### 1.1 Colonnes ajoutées sur `events`
- `seo_source_hash text` — hash de la source actuelle (recalculé à la lecture)
- `seo_generated_from_hash text` — hash de la source utilisée lors de la dernière génération Claude réussie
- `seo_generated_at timestamptz` — date du dernier appel Claude réussi
- `seo_last_checked_at timestamptz` — date du dernier passage sans appel Claude

Index partiel pour les recherches "à retraiter".

### 1.2 Fonction `compute_seo_source_hash(p_event_id uuid) returns text`
Hash `md5` (stable, déterministe) d'un payload JSONB normalisé :
- `nom_event`, `slug`, `date_debut`, `date_fin`
- `ville`, `code_postal`, `nom_lieu`, `pays`
- `secteur` (jsonb trié), `affluence`, `tarif`
- `description_event`, `meta_description_gen`, `url_site_officiel`
- `exhibitors_count` = `count(participation where id_event=event.id_event)`

Tout est `coalesce`é et trimmé pour éviter les faux changements (espaces, NULL vs '').

### 1.3 Fonction `seo_eligible_events(p_only_post_import boolean default false)`
Vue/fonction qui renvoie les `events` candidats avec :
- `visible=true`, `is_test=false`, `slug` non vide, `date_debut >= CURRENT_DATE`
- `coalesce(enrichissement_ignored,false)=false`
- `enrichissement_score >= 55`
- `current_hash` et un statut calculé :
  - `up_to_date` : `description_enrichie IS NOT NULL` ET `enrichissement_statut='valide'` ET `seo_generated_from_hash = current_hash`
  - `needs_claude` : tout le reste
- Si `p_only_post_import=true` : ne renvoie que les events créés/modifiés depuis le dernier run réussi.

### 1.4 Fonction `check_seo_automation_dependencies()` (remplace `check_seo_cron_dependencies`)
Renvoie en plus des checks existants :
- `would_call_claude_count` : nb d'events `needs_claude` si on lance maintenant
- `would_skip_count` : nb d'events `up_to_date`
- `ignored_count`
- `score_lt_55_count`
- `score_null_count`
- garde tous les checks techniques (secrets vault, pg_net, application_logs, run en cours, cron job présent/actif).

L'ancienne `check_seo_cron_dependencies()` est conservée comme alias (DROP + recreate qui appelle la nouvelle) pour ne rien casser.

### 1.5 Étendre `enrichissement_ignored` partout
- `score_events_batch` : déjà fait dans la migration précédente.
- `seo_eligible_events` : intègre le filtre.
- `seo-enrichment-batch` (edge function) : ajout du filtre `coalesce(enrichissement_ignored,false)=false` dans la sélection des candidats (côté SQL de l'edge).

---

## Migration 2 — Renommage (préparation cron hebdo, NON activé)

- `start_seo_cron_run()` reste en place mais devient l'implémentation interne ;
- création de `start_seo_weekly_catchup()` qui appelle l'edge avec `trigger_source='weekly_cron'`, `limit:20`, `deploy:true`.
- **Aucun `cron.schedule(...)` exécuté.** Une note SQL en commentaire documente la commande à lancer manuellement plus tard si rattrapage hebdo souhaité (dimanche 02:30 UTC ≈ 03:30/04:30 Paris).

---

## Edge function `seo-enrichment-batch` — anti-retraitement Claude

Modifications côté code (pas SQL) :

1. **Avant l'appel Claude pour chaque event** :
   - récupérer `current_hash = compute_seo_source_hash(event.id)` (via RPC ou recalcul JS strictement équivalent → on utilise la RPC SQL pour garantir égalité).
   - si `description_enrichie` présente ET `enrichissement_statut='valide'` ET `seo_generated_from_hash = current_hash` ET pas de `force_admin=true` dans le payload : **skip**, mettre à jour `seo_last_checked_at=now()`, comptabiliser dans `skipped_unchanged`.
2. **Après génération Claude réussie** :
   - écrire `seo_source_hash = seo_generated_from_hash = current_hash`, `seo_generated_at = now()`.
3. **Filtre de sélection initial** :
   - ajouter `coalesce(enrichissement_ignored,false)=false`.
4. **Réponse** : ajouter compteurs `skipped_unchanged`, `called_claude`, `ignored_filtered`, `would_call_claude` (mode dry).
5. **Nouveau mode** `mode:'post_import'` : ne traite que les events `needs_claude` créés/modifiés depuis le dernier `seo_enrichment_runs` réussi (fallback : 35 jours).

Aucun changement aux règles de validation, aucun changement Vercel (Deploy Hook reste gated sur `public_changed`).

---

## Edge function `seo-recompute-score` (déjà au plan, à confirmer comme créée)

Inchangé : RPC admin wrapper de `compute_event_enrichissement_score`. Sera utilisé par le bouton "Recalculer le score" dans le dashboard. Pas dans cette étape si pas encore présent.

---

## Dashboard `/admin/events/seo` — refonte vocabulaire + action post-import

Fichier : `src/components/admin/SeoEnrichmentDashboard.tsx`.

### Bloc renommé "Automatisation SEO" (anciennement "Cron SEO automatique")

- Titre : **Automatisation SEO**
- Recommandation actuelle : **Post-import recommandé**
- Tableau récapitulatif :
  - Manuel — ✅ disponible
  - Post-import — ✅ disponible
  - Hebdomadaire — ⏸ optionnel (non activé)
  - Nocturne quotidien — ❌ non recommandé (import mensuel)
- Bouton principal : **Traiter les nouveaux événements importés** (`mode:'post_import'`)
- Bouton secondaire grisé : **Activer rattrapage hebdomadaire** → ouvre une confirmation expliquant la commande SQL à exécuter (pas d'exécution auto).

### Carte renommée "Prêt pour automatisation récurrente"

Affiche le retour de `check_seo_automation_dependencies()` :
- ✅/❌ pour chaque check technique
- **Si vous lancez maintenant : X événements appelleront Claude** (en gros, en orange si >0)
- **Y événements seront skippés (déjà à jour)**
- **Z ignorés** / **N score <55** / **M score NULL**

### Confirmation avant lancement post-import

`AlertDialog` qui affiche :
- nb d'events qui appelleront Claude
- nb skippés
- mention "Coût estimé : ~X appels Claude, ~Y déploiements Vercel si contenu modifié"
- bouton "Lancer" / "Annuler"

### Résultat d'exécution

Carte "Résultat de la dernière action" complétée avec :
- `called_claude`, `skipped_unchanged`, `ignored_filtered`, `validated`, `failed`
- Deploy Hook : déclenché oui/non
- Liste des events traités avec statut avant/après

---

## Ce qui n'est PAS fait dans cette étape

- Aucun `cron.schedule(...)` n'est exécuté.
- Aucun appel à `seo-enrichment-batch` n'est déclenché par cette migration.
- Aucun build Vercel.
- Aucun appel Claude.
- Aucune modification du scoring (logique inchangée, seuls les filtres `ignored` sont étendus).

---

## Détails techniques (résumé)

| Élément | Type | Action |
|---|---|---|
| `events.seo_source_hash` | colonne | ADD |
| `events.seo_generated_from_hash` | colonne | ADD |
| `events.seo_generated_at` | colonne | ADD |
| `events.seo_last_checked_at` | colonne | ADD |
| `compute_seo_source_hash(uuid)` | fonction | CREATE |
| `seo_eligible_events(boolean)` | fonction | CREATE |
| `check_seo_automation_dependencies()` | fonction | CREATE |
| `check_seo_cron_dependencies()` | fonction | REWRITE → alias |
| `start_seo_weekly_catchup()` | fonction | CREATE (non programmée) |
| `seo-enrichment-batch/index.ts` | edge | filtre ignored + skip par hash + mode post_import |
| `SeoEnrichmentDashboard.tsx` | UI | renommage + post-import + previsions Claude |

## Critères de validation

1. Avant tout lancement, le dashboard indique combien d'events appelleront Claude.
2. Un event déjà valide avec hash inchangé ne consomme aucun crédit Claude.
3. Un event `enrichissement_ignored=true` n'est jamais sélectionné par scoring, batch ou cron.
4. Aucun cron actif n'existe après application.
5. L'action "Traiter les nouveaux événements importés" fonctionne sans déclencher Claude si rien n'a changé.
