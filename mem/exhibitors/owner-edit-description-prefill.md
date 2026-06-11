---
name: Préremplissage description (drawer owner)
description: Bloc C — resolveDescriptionPrefill priorise exhibitors.description brut puis la description affichée résolue (IA/legacy nettoyée) ; dette logo
type: feature
---
# Préremplissage du drawer d'édition owner

`resolveDescriptionPrefill(editable, displayedFallback)` (src/lib/exhibitorOwnerEdit.ts) :
1. `exhibitors.description` brut s'il est non vide ;
2. sinon `displayedFallback` = description ACTUELLEMENT affichée et résolue sur la fiche publique (owner > IA > legacy, déjà passée dans `cleanAiDescription`) ;
3. sinon `''`.

Le caller passe `resolvedDescription={cleanAiDescription(profile.description)}` au `ExhibitorOwnerEditDrawer` (depuis `ExhibitorClaimCta` et `ExhibitorManagerWidget`). La SAUVEGARDE écrit toujours `exhibitors.description` (champ cible inchangé, canal loggé inchangé).

Ceci remplace l'ancienne règle « jamais de fallback IA/legacy » : on pré-remplit désormais avec le texte affiché pour qu'une fiche à description IA s'ouvre prête à adopter/ajuster.

## Dette connue (à traiter séparément)
- Le LOGO a le même problème : `exhibitor_completion.has_logo=false` alors qu'un logo s'affiche (le logo affiché vient d'une autre source que `exhibitors.logo_url`). Le drawer ne pré-remplit pas le logo affiché. À corriger dans un second temps (même logique de fallback que la description).