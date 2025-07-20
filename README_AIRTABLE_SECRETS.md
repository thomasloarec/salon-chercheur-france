
# Configuration des secrets Supabase pour Airtable

## Variables requises

Les edge functions Airtable nécessitent les variables d'environnement suivantes :

| Variable | Description | Exemple |
|----------|-------------|---------|
| `AIRTABLE_PAT` | Personal Access Token Airtable | `patXXXXXXXXXXXXXX` |
| `AIRTABLE_BASE_ID` | ID de la base Airtable | `appXXXXXXXXXXXXXX` |
| `EVENTS_TABLE_NAME` | Nom de la table des événements | `All_Events` |
| `EXHIBITORS_TABLE_NAME` | Nom de la table des exposants | `All_Exposants` |
| `PARTICIPATION_TABLE_NAME` | Nom de la table participation | `Participation` |

## Configuration rapide

1. **Génération automatique de la commande :**
   ```bash
   deno run -A scripts/print-supabase-secret-cmd.ts
   ```

2. **Configuration manuelle :**
   ```bash
   supabase functions secrets set \
     AIRTABLE_PAT="votre_pat_ici" \
     AIRTABLE_BASE_ID="votre_base_id_ici" \
     EVENTS_TABLE_NAME="All_Events" \
     EXHIBITORS_TABLE_NAME="All_Exposants" \
     PARTICIPATION_TABLE_NAME="Participation"
   ```

## Vérification

Après configuration, lancez les tests de validation depuis l'interface admin :
- Allez sur `/admin`
- Cliquez sur "Lancer la batterie de tests"
- Vérifiez que l'étape "Vérification des variables d'environnement" est ✅

## Obtenir les valeurs Airtable

### Personal Access Token (PAT)
1. Allez sur [airtable.com/create/tokens](https://airtable.com/create/tokens)
2. Créez un nouveau token avec les permissions :
   - `data.records:read`
   - `data.records:write`
   - `schema.bases:read`

### Base ID
1. Ouvrez votre base Airtable
2. L'ID se trouve dans l'URL : `https://airtable.com/appXXXXXXXXXXXXXX/...`
3. Ou via l'API documentation de votre base

## Dépannage

### Erreur "missing_env"
Si vous voyez cette erreur dans les logs des edge functions :
1. Vérifiez que toutes les variables sont définies
2. Relancez la commande `supabase functions secrets set`
3. Attendez quelques secondes pour la propagation
4. Relancez les tests

### Tests qui échouent
1. Vérifiez les permissions de votre PAT Airtable
2. Confirmez que les noms de tables correspondent
3. Consultez les logs des edge functions pour plus de détails

## Sécurité

⚠️ **Important :** 
- Ne commitez jamais vos secrets dans le code
- Utilisez uniquement `supabase functions secrets set`
- Les secrets sont chiffrés et sécurisés dans Supabase
