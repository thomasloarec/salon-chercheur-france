## Phase D — Production contrôlée de l'enrichissement SEO

### Audit backlog (déjà exécuté en live)

État actuel sur les 209 événements futurs visibles :

| Indicateur | Valeur |
|---|---|
| Futurs visibles | 209 |
| Score NULL | 0 |
| Score < 35 | 0 |
| Score 35–54 | 97 |
| Score ≥ 55 | 112 |
| description_enrichie NULL | 98 |
| Statut `valide` | 114 |
| Statut `en_attente` | 0 |
| Statut `error` | 1 |
| auto_validation `passed` | 79 |
| auto_validation `failed` | 32 |
| auto_validation `warning` | 0 |
| validation_mode `auto` | 79 |
| validation_mode `manual` | 35 |

Distribution des causes de `failed` (32 events) :

- city_consistency (ville citée différente du lieu réel) : **17**
- numbers_grounded (chiffres non sourcés) : **16**
- venue_consistency (lieu cité incohérent) : **1**

(Plusieurs blockers possibles par event.) Aucun cas "programme inventé", "exposant non sourcé", "générique", ni "texte trop court" en blocker dur — ces motifs apparaissent en warnings et n'apparaissent pas dans le backlog actuel.

Conséquence : la **seule action utile à court terme** est le nettoyage automatique des 32 events `failed` (villes/chiffres) + génération des 98 descriptions manquantes via batch. Il n'y a plus rien à scorer.

---

### Ce que je vais construire

#### 1. Edge function `seo-auto-fix-simple-errors`
Nouvelle fonction, gated par `SEO_BATCH_SECRET`, qui :

1. Sélectionne les events `auto_validation_status='failed'` futurs visibles, avec `description_enrichie` non null.
2. Pour chaque event, applique des corrections **déterministes sans IA** sur `description_enrichie` :
   - **city_consistency** : retire ou remplace les villes incorrectes citées (token-level, case-insensitive, en gardant la ponctuation) par `ville` officielle quand le contexte le permet ; sinon supprime la phrase contenant la ville fausse si elle reste cohérente sans.
   - **venue_consistency** : même logique avec `nom_lieu`.
   - **numbers_grounded** : supprime les phrases contenant des chiffres signalés comme non sourcés (les blockers donnent les contextes), garde le reste.
3. Recalcule via `validateEnrichedDescription` (partagé) :
   - `passed` → `enrichissement_statut='valide'`, `validation_mode='auto'`, `auto_validation_*` mis à jour.
   - sinon → garde l'event en file avec les nouveaux blockers (les anciens motifs corrigés disparaissent).
4. Retourne un rapport `{ processed, fixed, still_failed, by_reason }`.
5. **Ne déclenche pas Vercel** depuis la fonction. Le dashboard décide via le hook existant si ≥1 event est passé en `valide`.
6. Mode `dry_run` supporté pour tester.

Garde-fous : jamais d'invention (chiffre, exposant, prix, lieu, programme). Seules opérations = suppression ou remplacement par valeur officielle déjà en base.

#### 2. Dashboard `SeoEnrichmentDashboard`

Refonte du bloc "Action recommandée maintenant" en moteur de décision unique :

```text
Priorité 1 : lastRun.status='failed' ET unresolvedIds>0
  → "Le dernier run a échoué. Corrige les erreurs avant de relancer."
Priorité 2 : auto_validation_failed > 0
  → "X textes en échec de validation."
    Bouton: "Corriger automatiquement les erreurs simples"
Priorité 3 : score_null > 0
  → "X événements sans score SEO."
    Bouton: "Scorer 20 événements"
Priorité 4 : desc_null > 0 ET ready_for_batch > 0 ET dernier batch pilote propre
  → "Backlog prêt." Bouton: "Lancer Batch 20"
Priorité 5 : desc_null > 0 ET (pas encore 3 batchs réussis OU taux auto-val < 70%)
  → "Pilote recommandé." Bouton: "Lancer Batch pilote 5"
Priorité 6 : tous critères cron OK
  → "Système prêt." Bouton: "Préparer activation cron"
Sinon → "Rien à faire."
```

Nouveaux éléments visibles :

- **Bouton "Scorer 20 événements sans score"** → appel RPC `score_events_batch(20, false, true)`, affiche delta de distribution score_null/lt_35/35_54/gte_55, ne touche pas Vercel.
- **Bouton "Corriger automatiquement les erreurs simples"** → appelle la nouvelle edge function, affiche `processed/fixed/still_failed/by_reason`.
- **Bouton "Lancer Batch pilote 5"** et **"Lancer Batch 20"** → réutilisent le proxy existant avec `limit=5` ou `20`.
- **Carte "Prêt pour cron nocturne"** avec critères et raisons.
- **Bouton "Préparer activation cron"** désactivé tant que critères non remplis. Au clic (futur) : modal de confirmation forte, mais **aucune création de cron job** dans cette phase.

Critères cron évalués côté client à partir des derniers `seo_batch_runs` :

- ≥ 3 runs `success` consécutifs sur les 5 derniers
- 0 run avec `error` technique sur les 5 derniers
- taux auto-validation moyen ≥ 70 % sur les 3 derniers batchs (`auto_validated / processed`)
- `auto_validation_failed` < 20
- `score_null` = 0
- dernier run a déclenché Vercel sans erreur (champ existant `vercel_deploy_triggered`)

#### 3. Documentation cron (sans activation)

Ajout d'un encart "Configuration cible cron nocturne" en lecture seule :

```
fréquence : 1× par nuit (03:00 UTC)
limit     : 20
mode      : run
deploy    : true
trigger   : cron
```

Pas de `pg_cron` créé. Pas de secret écrit.

---

### Détails techniques

**Fichiers à créer**
- `supabase/functions/seo-auto-fix-simple-errors/index.ts` — logique de correction + revalidation, dual-client pattern, secret-gated.

**Fichiers à modifier**
- `src/components/admin/SeoEnrichmentDashboard.tsx` — refonte "Action recommandée", ajout des 4 actions, carte critères cron, bouton cron désactivé.

**Aucune migration SQL** : tout est lecture + UPDATE via service role en edge function. La fonction RPC `score_events_batch` existe déjà.

**Sécurité** : la nouvelle edge function exige `x-seo-batch-secret` comme les autres fonctions du flux SEO, et passe par `admin-seo-batch-proxy` pour être appelée depuis le navigateur admin (à étendre côté proxy si le path n'est pas déjà supporté — vérification au moment de l'implémentation).

**Hors scope explicite** : pas d'activation du cron, pas d'enrichissement IA dans le correcteur, pas de modification des events `valide` existants.

### Tests post-implémentation

- **Test A** : afficher l'audit ci-dessus dans le dashboard (déjà couvert par les KPIs).
- **Test C** : dry-run de `seo-auto-fix-simple-errors` sur 3 events `failed` pour vérifier le rapport, puis run réel.
- **Test D** : Batch pilote 5 manuel après nettoyage, vérifier que taux auto-validation ≥ 70 %.
- Test B (scoring) : sans objet, `score_null = 0`.
