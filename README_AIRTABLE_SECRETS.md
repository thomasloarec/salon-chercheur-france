
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
6. **🚨 REDÉPLOYEZ TOUTES LES FUNCTIONS** :
   ```bash
   supabase functions deploy --all
   ```
   **Cette étape est cruciale** car toutes les edge functions doivent être redéployées pour accéder aux nouveaux secrets.
7. **Utilisez le widget "Vérification finale"** pour confirmer que tout fonctionne

## Configuration manuelle

Si vous préférez configurer manuellement :

```bash
# 1. Configurez les secrets
supabase functions secrets set \
  AIRTABLE_PAT="votre_pat_ici" \
  AIRTABLE_BASE_ID="SLxgKrY3BSA1nX" \
  EVENTS_TABLE_NAME="All_Events" \
  EXHIBITORS_TABLE_NAME="All_Exposants" \
  PARTICIPATION_TABLE_NAME="Participation"

# 2. OBLIGATOIRE: Redéployez toutes les functions
supabase functions deploy --all
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

L'interface admin vérifie automatiquement la configuration via le **Widget "Vérification finale"** :
- ✅ **Voyant vert** : Toutes les variables sont configurées et fonctionnelles
- ❌ **Alerte rouge** : Variables manquantes avec liste exacte
- 🔄 **Tests automatiques** : Connexion Airtable et anti-doublons testés en temps réel

## Dépannage

### Variables encore manquantes après configuration
1. Vérifiez que la commande `supabase functions secrets set` a été exécutée sans erreur
2. **IMPORTANT** : Redéployez obligatoirement toutes les functions :
   ```bash
   supabase functions deploy --all
   ```
3. Attendez quelques secondes pour la propagation
4. Utilisez le widget "Vérification finale" pour re-vérifier

### Tests qui échouent après déploiement
1. Vérifiez les permissions de votre PAT Airtable
2. Confirmez que les noms de tables correspondent à votre base
3. Consultez les logs des edge functions dans le dashboard Supabase

### Différence entre edge functions
Toutes les edge functions utilisent maintenant une **fonction unifiée** pour lire les variables :
- `getEnvOrConfig()` : utilise d'abord la variable d'environnement, puis la config par défaut
- `checkMissingVars()` : liste identique des variables manquantes dans toutes les functions
- Cohérence garantie entre `airtable-status`, `airtable-smoke-test`, et `check-secrets`

## Sécurité

⚠️ **Important :** 
- Ne commitez jamais vos secrets dans le code
- Utilisez uniquement `supabase functions secrets set`
- Les secrets sont chiffrés et sécurisés dans Supabase
- L'interface admin ne stocke aucune valeur sensible côté client
- Les valeurs de configuration (base ID, noms de tables) sont partagées mais le PAT reste sécurisé

## CI/CD

Ajoutez au pipeline avant `supabase functions deploy` :

```bash
# Configuration des secrets (si automatisé)
supabase functions secrets set AIRTABLE_PAT="$AIRTABLE_PAT_SECRET" # etc.

# OBLIGATOIRE: Déploiement de toutes les functions
supabase functions deploy --all
```
