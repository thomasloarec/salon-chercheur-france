
# Import des Communes depuis l'API Géographique

Ce script importe toutes les communes françaises depuis l'API officielle `geo.api.gouv.fr` dans la base de données Supabase.

## Prérequis

- Node.js et npm installés
- ts-node installé (`npm install -g ts-node` si nécessaire)
- Clé de service Supabase (service_role key)

## Configuration

Vous devez définir la variable d'environnement `SUPABASE_SERVICE_KEY` avec votre clé de service Supabase.

## Exécution

```bash
# Définir la clé de service
export SUPABASE_SERVICE_KEY="votre_service_role_key_ici"

# Exécuter le script
npx ts-node scripts/importCommunesFromAPI.ts
```

Ou en une ligne :
```bash
SUPABASE_SERVICE_KEY="votre_service_role_key_ici" npx ts-node scripts/importCommunesFromAPI.ts
```

## Ce que fait le script

1. **Récupère** toutes les communes depuis `https://geo.api.gouv.fr/communes`
2. **Transforme** les données : 1 ligne par couple (commune, code_postal)
3. **Supprime** les données existantes dans la table `communes`
4. **Insère** les nouvelles données par paquets de 1000 lignes
5. **Vérifie** l'import en comptant les lignes et en testant Villepinte (93420)
6. **Teste** la fonction de suggestions avec "ile de france"

## Résultats attendus

- **~35 000 lignes** insérées (communes × codes postaux)
- **Villepinte 93420** présente dans les résultats
- **Suggestions géographiques** fonctionnelles pour "Île-de-France"

## Vérification manuelle

Après l'exécution, vous pouvez vérifier dans Supabase :

```sql
-- Compter les communes
SELECT count(*) FROM communes;

-- Vérifier Villepinte
SELECT * FROM communes WHERE code_postal = '93420';

-- Tester les suggestions
SELECT * FROM get_location_suggestions('ile de france');
```

## Dépannage

### Erreur de permissions
Si vous obtenez une erreur de permissions, vérifiez que :
- Vous utilisez bien la clé `service_role` (pas `anon`)
- La clé est correctement définie dans la variable d'environnement

### Erreur réseau
Si l'API geo.api.gouv.fr est indisponible :
- Réessayez plus tard
- Vérifiez votre connexion internet

### Erreur de base de données
Si l'insertion échoue :
- Vérifiez que la table `communes` existe
- Vérifiez que les colonnes correspondent au schéma attendu
