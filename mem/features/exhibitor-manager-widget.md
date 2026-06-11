---
name: Espace gestionnaire (fiche exposant)
description: Widget gestionnaire sur /exposants/{slug} — visibilité, affichage intelligent, vue exhibitor_completion, has_upcoming_participation
type: feature
---
# Espace gestionnaire — fiche exposant publique

Widget affiché EN HAUT de `/exposants/{slug}` (`ExhibitorManagerWidget.tsx`, monté dans `ExhibitorProfile.tsx`).

## Visibilité
- Réutilise EXACTEMENT `canEditExhibitorProfile` (même prédicat que « Modifier cette fiche ») : gestionnaire actif (owner/admin) connecté, fiche moderne non-test. Visiteurs et gestionnaires d'autres fiches → `null`.
- Score et palier (bronze/argent/or) sont PRIVÉS au widget — jamais affichés dans l'en-tête public.

## Affichage intelligent
- Visible si `profile_score < 100` OU (`has_upcoming_participation` ET NON `has_upcoming_novelty`).
- Masqué si 100 % ET pas de nudge Nouveauté. Recalculé depuis la vue à chaque chargement → réapparaît sur nouvelle participation sans Nouveauté.
- Repli/dépli au sein de la session (état local, non persisté).

## Vue exhibitor_completion
- Colonne `has_upcoming_participation` ajoutée EN DERNIÈRE position (contrainte CREATE OR REPLACE VIEW : nouvelles colonnes en fin, sinon erreur de renommage).
- Définie comme : participation sur un événement NON terminé `COALESCE(e.date_fin, e.date_debut)::date >= CURRENT_DATE` et `is_test=false` → couvre « à venir OU en cours », cohérent avec la stat de carte « Salons à venir / en cours ».
- Barème score inchangé : description≥120c=25, logo=20, website=15, linkedin=15, gouvernance=25. `has_upcoming_participation` n'entre PAS dans le score.
- Vue en `security_invoker = true`.

## Actions du widget
- Items éditoriaux manquants (description, logo, site, linkedin) → ouvrent `ExhibitorOwnerEditDrawer` (instance propre au widget).
- Gouvernance (owner only) : « Je gère seul(e) » → `update exhibitors.governance_state='solo'` (+25) ; « Inviter » → edge `exhibitors-manage` action `owner_add_member` puis `governance_state='team'`.
- Nudge Nouveauté (objectif Or) si participation à venir/en cours sans Nouveauté publiée.

## Annuaire
- `MyExhibitorsSection` reste un annuaire simple. La jauge enterrée (`ExhibitorCompletionCard`) y a été RETIRÉE et le composant supprimé, pour éviter le doublon avec ce widget.
++ End Patch