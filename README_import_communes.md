
# Import complet des communes françaises

## Prérequis

- Node 18+
- SUPABASE_URL (ex : https://xxxxx.supabase.co)
- SUPABASE_SERVICE_KEY (clé service-role)

## Installation rapide

```bash
npm install -D ts-node node-fetch@^3 @supabase/supabase-js
```

## Lancer l'import

```bash
export SUPABASE_URL="https://<projet>.supabase.co"
export SUPABASE_SERVICE_KEY="<service-role>"
npx ts-node scripts/importCommunesFromAPI.ts
```

Le script :
- récupère ~35 000 communes via l'API geo.api.gouv.fr
- démultiplie les codes postaux
- insère en batch de 1 000 (upsert) dans la table communes

## Vérification

Après l'import, vérifiez dans Supabase :

```sql
-- Compter les communes
SELECT count(*) FROM communes;

-- Vérifier Villepinte
SELECT * FROM communes WHERE code_postal = '93420';

-- Tester les suggestions
SELECT * FROM get_location_suggestions('ile de france');
```

## Résultats attendus

- **~35 000 lignes** insérées (communes × codes postaux)
- **Villepinte 93420** présente dans les résultats
- **Suggestions géographiques** fonctionnelles pour "Île-de-France"
