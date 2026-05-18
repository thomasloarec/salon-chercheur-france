
# Auto-validation des descriptions enrichies

## 1. Schéma — migration `events`

Ajouter 5 colonnes (toutes nullable) :
- `auto_validation_status text` — `passed` | `warning` | `failed`
- `auto_validation_score integer` — 0-100
- `auto_validation_report jsonb` — `{ checks: [...], blockers: [...], warnings: [...], stats: {...} }`
- `auto_validated_at timestamptz`
- `validation_mode text` — `auto` | `manual` | `rejected`

Pas d'index ni de contrainte CHECK (souplesse).

## 2. Module de validation partagé

Créer `supabase/functions/_shared/validate-enriched-description.ts` (utilisable par `enrich-event-meta`, `seo-enrichment-batch`, et une future fonction `revalidate-enriched-description`).

Signature :
```ts
validateEnrichedDescription(description: string, source: EventSource, exhibitorsNames: string[]): ValidationResult
```

Contrôles exécutés (chacun produit `pass | warning | fail`, contribue au score, peut être bloquant) :

| Code | Catégorie | Bloquant | Pénalité |
|---|---|---|---|
| `length_min` | longueur ≥ 250 mots premium / 180 standard | oui (< minimum) | -100 si fail |
| `date_consistency` | dates citées ⊂ {date_debut, date_fin, année} | oui | -100 |
| `city_consistency` | villes citées ⊂ {ville, pays} | oui | -100 |
| `venue_consistency` | si `nom_lieu` cité, doit matcher | oui | -100 |
| `numbers_grounded` | tout nombre (visiteurs/exposants/éditions/m²/%) doit avoir une source en base | oui | -100 |
| `exhibitors_grounded` | noms d'exposants cités ⊂ liste participations | oui | -100 |
| `price_invented` | mention "€", "gratuit", "tarif", "billet" → fail si pas de `tarif` | oui | -100 |
| `program_invented` | mention conférence/atelier/horaire précis → fail | oui | -100 |
| `superlatives` | "le plus grand", "n°1", "leader mondial", "incontournable", "unique en France" | non (warning) | -10 |
| `commercial_promise` | "garantit", "tous les professionnels", "100%" | non (warning) | -10 |
| `generic_text` | densité de mots-clés trop faible (event-specific tokens < 3%) | non (warning) | -10 |
| `repetition` | n-grammes répétés > seuil | non (warning) | -5 |
| `fake_faq` | détecte "Question :", "Q :", patterns FAQ | non (warning) | -10 |

Détection des nombres : regex `\b\d[\d  .,]*\b` + contexte ; exclu : années identiques aux dates source, numéros de rue/CP de l'événement.

Score = 100 - somme(pénalités), borné [0, 100].

Décision :
- 1+ bloquant → `failed`, score forcé ≤ 50
- 0 bloquant, score ≥ 85 → `passed`
- sinon → `warning`

## 3. Intégration `enrich-event-meta`

Après génération de `description_enrichie`, avant l'UPDATE final :
1. Charger `participations_with_exhibitors` pour cet event (déjà fait pour l'enrichissement)
2. Appeler `validateEnrichedDescription`
3. Écrire dans l'UPDATE :
   - `auto_validation_status`, `auto_validation_score`, `auto_validation_report`, `auto_validated_at = now()`
   - Si `passed` : `enrichissement_statut = 'valide'`, `validation_mode = 'auto'`
   - Sinon : `enrichissement_statut = 'en_attente'`, `validation_mode = 'manual'`

`seo-enrichment-batch` n'a rien à changer (il délègue à `enrich-event-meta`).

## 4. Fonction `revalidate-enriched-description` (pour le test)

Nouvelle edge function POST `{ event_ids: string[], dry_run: boolean }` :
- Recharge les events + participations
- Re-joue la validation sur `description_enrichie` existant
- Si `dry_run=true` : ne touche pas la base, renvoie le rapport
- Sinon : applique la décision (status/score/report/mode)

Utilisée pour le test IFTM/IPEM demandé en §6 sans regénérer le texte.

## 5. Admin UI — `EnrichedDescriptionValidation.tsx`

- Étendre l'interface `EventRow` avec les 5 nouvelles colonnes
- Charger aussi `enrichissement_statut = 'valide'` quand `validation_mode = 'auto'` (pour les auditer)
- Badges (composants existants) :
  - vert `Validé automatiquement` (status=passed, mode=auto)
  - orange `À relire` (status=warning)
  - rouge `Échec validation` (status=failed)
  - badges secondaires pour chaque code de check échoué : `Chiffre non vérifié`, `Date incohérente`, `Exposant inventé`, `Texte trop court`, `Superlatif non sourcé`, etc.
- Filtres (tabs ou Select) : `Tous` / `Validés auto` / `Warnings` / `Failed` / `À valider manuellement`
- Panneau détail : afficher `auto_validation_report` (liste des checks avec leur statut)

## 6. Test IFTM + IPEM

Sans modifier la base ni déployer Vercel :
1. Déployer la nouvelle edge function `revalidate-enriched-description`
2. Appel `{ event_ids: [IFTM_id, IPEM_id], dry_run: true }`
3. Retour utilisateur :
   - score, status, report détaillé par check
   - décision finale (passerait en auto / resterait en attente + raison)

Ensuite, sur accord utilisateur, relancer avec `dry_run: false` pour appliquer.

## 7. Garde-fous respectés

- Aucun Deploy Hook Vercel déclenché
- Aucun cron activé
- Aucun batch massif lancé
- Le rendu public (`EventPageHeader`, prerender) est inchangé : il continue de lire `enrichissement_statut='valide'` ; la nouveauté c'est que ce statut peut être positionné automatiquement.

## Détails techniques

- Module de validation en TypeScript pur (pas de dépendance externe), testable hors edge function
- Tests Deno minimaux : 1 cas "texte propre IFTM" + 1 cas "texte avec chiffre inventé" + 1 cas "date contradictoire"
- L'admin reste rétrocompatible : les events déjà `en_attente` sans `auto_validation_report` s'affichent avec un badge neutre "Non auto-validé"
