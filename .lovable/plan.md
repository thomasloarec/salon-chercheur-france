# Corriger le formatage des descriptions d’événement

## Objectif
Garantir que la description saisie depuis l’espace organisateur ou la fenêtre d’administration conserve ses paragraphes et retours à la ligne sur la page publique, sans afficher de balises comme `</p><p>`.

## Modifications
- Normaliser la description dans les deux interfaces d’édition : texte lisible dans le champ organisateur, HTML propre dans l’éditeur enrichi administrateur.
- Centraliser la conversion afin de gérer correctement le texte brut, le HTML déjà valide et les anciennes valeurs contenant des balises échappées.
- Rendre la description publique avec des paragraphes et retours à la ligne cohérents, après nettoyage de sécurité.
- Ajouter des tests ciblés couvrant texte brut, paragraphes, retours simples et balises échappées.

## Validation
- Vérifier les conversions par tests automatisés.
- Vérifier TypeScript.
- Contrôler visuellement une page salon sur ordinateur et mobile, en confirmant l’absence de balises visibles.

## Périmètre technique
Aucun changement de base de données. Les corrections restent limitées aux utilitaires de texte, aux deux formulaires concernés et au bloc public « Tout savoir sur… ».
