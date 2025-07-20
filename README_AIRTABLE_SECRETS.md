
# Configuration des secrets Supabase pour Airtable

## Variables requises

Les edge functions Airtable nécessitent les variables d'environnement suivantes :

| Variable | Description | Valeur |
|----------|-------------|---------|
| `AIRTABLE_PAT` | Personal Access Token Airtable | `patXXXXXXXXXXXXXX` |
| `AIRTABLE_BASE_ID` | ID de la base Airtable | `SLxgKrY3BSA1nX` |
| `EVENTS_TABLE_NAME` | Nom de la table des événements | `All_Events` |
| `EXHIBITORS_TABLE_NAME` | Nom de la table des exposants | `All_Exposants` |
| `PARTICIPATION_TABLE_NAME` | Nom de la table participation | `Participation` |

## Configuration automatique via l'interface Admin

1. **Accédez à la page Admin** : `/admin`
2. **Vérification automatique** : L'interface vérifie automatiquement les variables manquantes
3. **Si des variables manquent** :
   - Un encart rouge s'affiche avec la liste des variables manquantes
   - Une commande pré-remplie est fournie avec les bonnes valeurs
   - Cliquez sur **"Copier la commande"** pour copier automatiquement
4. **⚠️ Important** : La clé `AIRTABLE_PAT` n'est pas pré-remplie par sécurité
   - Complétez `AIRTABLE_PAT=""` avec votre Personal Access Token
   - Exemple : `AIRTABLE_PAT="patXXXXXXXXXXXXXX"`
5. **Exécutez la commande** dans votre terminal
6. **Redéployez les functions** :
   ```bash
   supabase functions deploy airtable-proxy airtable-smoke-test
   ```
7. **Cliquez sur "J'ai configuré les secrets"** pour vérifier la configuration

## Configuration manuelle

Si vous préférez configurer manuellement :

```bash
supabase functions secrets set \
  AIRTABLE_PAT="votre_pat_ici" \
  AIRTABLE_BASE_ID="SLxgKrY3BSA1nX" \
  EVENTS_TABLE_NAME="All_Events" \
  EXHIBITORS_TABLE_NAME="All_Exposants" \
  PARTICIPATION_TABLE_NAME="Participation"
```

## Obtenir les valeurs Airtable

### Personal Access Token (PAT)
1. Allez sur [airtable.com/create/tokens](https://airtable.com/create/tokens)
2. Créez un nouveau token avec les permissions :
   - `data.records:read`
   - `data.records:write`
   - `schema.bases:read`

### Base ID
L'ID de votre base Airtable est `SLxgKrY3BSA1nX` (pré-configuré).

## Vérification

L'interface admin vérifie automatiquement la configuration :
- ✅ **Voyant vert** : Toutes les variables sont configurées
- ❌ **Alerte rouge** : Variables manquantes avec commande auto-générée
- 🔄 **Bouton "J'ai configuré les secrets"** : Re-vérification instantanée

## Dépannage

### Variables encore manquantes après configuration
1. Vérifiez que la commande a été exécutée sans erreur
2. Attendez quelques secondes pour la propagation des secrets
3. Redéployez les functions : `supabase functions deploy`
4. Cliquez sur "J'ai configuré les secrets" pour re-vérifier

### Tests qui échouent
1. Vérifiez les permissions de votre PAT Airtable
2. Confirmez que les noms de tables correspondent à votre base
3. Consultez les logs des edge functions pour plus de détails

## Sécurité

⚠️ **Important :** 
- Ne commitez jamais vos secrets dans le code
- Utilisez uniquement `supabase functions secrets set`
- Les secrets sont chiffrés et sécurisés dans Supabase
- L'interface admin ne stocke aucune valeur sensible côté client
- Les valeurs de configuration (base ID, noms de tables) sont partagées mais le PAT reste sécurisé
