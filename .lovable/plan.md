# Plan : remplacer les descriptions « Données insuffisantes pour analyse. »

## Diagnostic (vérifié en base)

- Le texte ne vient **pas de notre code** : il est stocké dans `exhibitor_ai.resume_court`, écrit par une ancienne passe d'enrichissement IA. Notre prompt actuel (`enrich-exposants-ai`) demande pourtant une chaîne vide en cas de manque d'info — mais le modèle a parfois renvoyé un refus rédigé à la place.
- **Ampleur** :
  - `resume_court = 'Données insuffisantes pour analyse.'` exact → **784 lignes**
  - Variantes proches (`insuffisant`, `impossible … analyser`, « Aucune description ni contenu web fourni », etc.) → **~1 305 lignes** au total.
  - Sur ces ~1 305, seulement **23** disposent d'une vraie description ailleurs (legacy `exposants.exposant_description`) : pour les autres, `resume_court` est le seul texte affiché.
- **Où c'est consommé** :
  1. Vues SQL (`participations_with_exhibitors`, etc.) : `resume_court` sert de `ai_summary` et de **dernier maillon** du COALESCE de `description`.
  2. Edge functions `exhibitors-by-event` et `prepare-visit` (lecture directe de `resume_court`).
  3. Frontend via `hydrateExhibitor` → `ai_resume_court`.

## Objectif

Quand le résumé IA est un message de refus (« Données insuffisantes… » et variantes), ne plus l'afficher et montrer à la place : **« Aucune description pour cette entreprise. »**

## Correction en 3 volets

### Volet A — Une règle de détection centralisée
Pour éviter d'éparpiller la logique, on définit une seule définition du « refus IA » :
- **SQL** : fonction immuable `public.is_ai_refusal(text) returns boolean` (regex couvrant `insuffisant`, `impossible … (analys|qualifi)`, « aucune description ni contenu web », etc.).
- **TS** : helper partagé `isAiRefusal(text)` + constante `NO_DESCRIPTION_LABEL = "Aucune description pour cette entreprise."` dans `src/lib/`.

### Volet B — Prévention (futurs enrichissements)
Dans `supabase/functions/enrich-exposants-ai/index.ts`, après parsing de la réponse Claude : si `resume_court` matche `isAiRefusal`, on enregistre `''` (vide) au lieu du texte de refus. Plus aucune nouvelle ligne ne portera le message.

### Volet C — Nettoyage de l'existant + affichage
1. **Données (réversible)** : migration de données en 2 temps — d'abord COMPTER, puis `UPDATE exhibitor_ai SET resume_court = NULL WHERE is_ai_refusal(resume_court)` (avec sauvegarde des valeurs dans une table d'archive pour rollback). Effet : les vues SQL cessent d'utiliser ce texte comme description / `ai_summary`, et le SEO/IA cessent de l'ingérer.
2. **Affichage** : aux points où la description finale est résolue (fiche exposant + cartes), quand le texte résolu est vide **ou** matche `isAiRefusal`, afficher `NO_DESCRIPTION_LABEL`. La détection à l'affichage agit aussi comme filet de sécurité pour les 23 cas particuliers et tout résidu.

## Détails techniques

- **Volet A** : nouvelle migration créant `is_ai_refusal` (langage `sql`, `immutable`) ; nouveau fichier `src/lib/exhibitorDescription.ts` exportant `isAiRefusal` + `NO_DESCRIPTION_LABEL` + un `resolveExhibitorDescription()` qui applique la cascade existante puis le fallback.
- **Volet B** : ~3 lignes dans la boucle d'insertion de `enrich-exposants-ai`.
- **Volet C.1** : table `exhibitor_ai_refusal_archive(exhibitor_id, resume_court, archived_at)` + UPDATE conditionnel via l'outil d'insertion (données, pas schéma). Requête de rollback fournie dans le rapport.
- **Volet C.2** : application de `resolveExhibitorDescription` dans `hydrateExhibitor.ts` et les composants d'affichage de la fiche/cartes exposant ; les edge functions `exhibitors-by-event` / `prepare-visit` filtrent aussi le refus avant renvoi.
- Aucun autre champ (nom, logo, secteurs, statut…) n'est modifié. Les grants et la signature des vues restent identiques (on change uniquement la valeur sous-jacente, pas la structure).

## Livrable / rapport final
- Nombre de lignes archivées puis nettoyées (avant/après).
- Échantillon 10 lignes (avant → après).
- Confirmation que seules `resume_court` (et son archive) sont touchées.
- Requête de rollback.
