# Harmoniser les listes filtrées de salons

## Objectif
Conserver les en-têtes, textes, liens et blocs éditoriaux propres à chaque page, tout en présentant les résultats comme sur `/salons` : une liste horizontale pleine largeur, regroupée par mois.

## Modifications
- Remplacer la grille de cartes des pages ville + année par la variante liste déjà utilisée sur `/salons`.
- Remplacer la grille de cartes des pages secteur + année par cette même variante liste.
- Vérifier les autres pages publiques par ville, secteur ou année et aligner tout résultat principal encore présenté en cartes, sans modifier leurs contenus éditoriaux ni leurs filtres.
- Conserver les compteurs d’exposants et de nouveautés sur chaque ligne.

## Validation
- Vérifier `/ville/paris/2026`, `/ville/bordeaux/2026` et `/secteur/sante-medical/2026` sur ordinateur et mobile.
- Confirmer que les pages sans année gardent leur présentation actuelle et qu’aucune carte verticale ne subsiste dans les résultats filtrés concernés.
- Exécuter la vérification TypeScript ciblée du projet.

## Détails techniques
La variante `view="list"` du composant événement existant sera réutilisée, avec les séparateurs mensuels communs, afin d’éviter un second design divergent.
