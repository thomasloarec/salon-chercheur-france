
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

## Processus pas-à-pas détaillé

### Étape 1 : Configuration des secrets
```bash
# Copiez la commande depuis l'interface admin et complétez AIRTABLE_PAT
supabase functions secrets set \
  AIRTABLE_PAT="votre_pat_ici" \
  AIRTABLE_BASE_ID="SLxgKrY3BSA1nX" \
  EVENTS_TABLE_NAME="All_Events" \
  EXHIBITORS_TABLE_NAME="All_Exposants" \
  PARTICIPATION_TABLE_NAME="Participation"
```

### Étape 2 : Redéploiement obligatoire
```bash
# OBLIGATOIRE: Redéployez toutes les functions
supabase functions deploy --all
```

### Étape 3 : Vérification
1. Retournez sur `/admin`
2. Le widget "Vérification finale" doit afficher tous les voyants verts
3. Les tests de validation et anti-doublons se déclenchent automatiquement

## Diagnostic des erreurs

### 🔍 Widget "Vérification finale"

Le widget affiche maintenant des informations de diagnostic détaillées :

- **Configuration secrets** : Vérifie la présence des 5 variables Supabase
- **Tests de validation** : Test de connexion réelle à Airtable
- **Messages d'erreur spécifiques** selon le type de problème

### 🚨 Erreurs courantes et solutions

#### Erreur "Variables manquantes"
```
❌ Configuration secrets : Variables manquantes: AIRTABLE_PAT
```
**Solution :** Configurez les secrets manqués et redéployez

#### Erreur "Airtable 404"
```
❌ Tests de validation : Airtable 404 - Base ou table introuvable
```
**Solutions :**
1. Vérifiez `AIRTABLE_BASE_ID` : doit être `SLxgKrY3BSA1nX`
2. Connectez-vous à Airtable et vérifiez que les tables existent :
   - `All_Events`
   - `All_Exposants` 
   - `Participation`
3. Vérifiez les permissions de votre PAT

#### Erreur "Airtable 401"
```
❌ Tests de validation : Airtable 401 - Authentification échouée
```
**Solution :** Vérifiez votre `AIRTABLE_PAT` (Personal Access Token)

### 🛠️ Commandes de diagnostic

#### Vérifier les secrets d'une function spécifique
```bash
supabase functions secrets list airtable-proxy
supabase functions secrets list airtable-smoke-test
supabase functions secrets list check-secrets
supabase functions secrets list airtable-status
```

#### Vérifier les logs d'une function
```bash
supabase functions logs airtable-proxy
supabase functions logs airtable-status
```

#### Tester une function manuellement
```bash
# Test simple de vérification des secrets
curl -X POST "https://[votre-projet].supabase.co/functions/v1/check-secrets" \
  -H "Authorization: Bearer [votre-anon-key]" \
  -H "apikey: [votre-anon-key]"
```

### 🔧 Debug avancé

#### Informations de debug dans le widget
Cliquez sur "Informations de debug" dans le widget pour voir :
- Quelles variables sont définies via l'environnement vs config
- Les premiers caractères des valeurs (pour vérification sans exposer les secrets)
- Le contexte détaillé des erreurs

#### Logs détaillés dans les edge functions
Toutes les functions loggent maintenant :
- `[nom-function] 🔍 Début...` : Démarrage
- `[nom-function] ✅ Variables OK` : Variables trouvées  
- `[nom-function] ❌ Erreur...` : Erreurs avec contexte
- `[nom-function] 📊 Debug variables` : Informations détaillées

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

# 3. Vérifiez sur /admin
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
- ✅ **Configuration secrets** : Toutes les variables sont présentes
- ✅ **Tests de validation** : Connexion Airtable et accès aux tables
- ✅ **Anti-doublons** : Normalisation d'URL et prévention des doublons
- ✅ **Boutons actifs** : Synchronisation disponible

### Déclenchement automatique
Après configuration des secrets, les tests se lancent automatiquement pour confirmer que tout fonctionne.

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
4. Utilisez les informations de debug dans le widget

### Incohérence "secrets OK / variables manquantes"
Si le widget affiche "Configuration secrets ✅" mais "Tests ❌ Variables manquantes" :

1. **Vérification différentielle** : Les edge functions utilisent maintenant deux vérifications :
   - `listMissing()` : vérification stricte des secrets Supabase (sans fallback)
   - `checkMissingVars()` : vérification logique avec fallbacks de configuration

2. **Solution** : Toutes les variables doivent être définies comme secrets Supabase :
   ```bash
   supabase functions secrets set \
     AIRTABLE_PAT="votre_pat" \
     AIRTABLE_BASE_ID="SLxgKrY3BSA1nX" \
     EVENTS_TABLE_NAME="All_Events" \
     EXHIBITORS_TABLE_NAME="All_Exposants" \
     PARTICIPATION_TABLE_NAME="Participation"
   ```

3. **Redéploiement obligatoire** après chaque modification de secrets

### Différence entre edge functions
Toutes les edge functions utilisent maintenant une **fonction unifiée** pour lire les variables :
- `listMissing()` : diagnostic strict des secrets Supabase
- `getEnvOrConfig()` : utilise d'abord la variable d'environnement, puis la config par défaut
- `checkMissingVars()` : liste des variables manquantes avec fallbacks
- `debugVariables()` : informations détaillées pour le diagnostic
- Cohérence garantie entre toutes les functions

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

## Checklist finale

- [ ] Secrets configurés avec `supabase functions secrets set`
- [ ] Functions redéployées avec `supabase functions deploy --all`
- [ ] Widget "Vérification finale" tout vert sur `/admin`
- [ ] Tests de validation et anti-doublons passent automatiquement
- [ ] Boutons de synchronisation actifs
- [ ] Aucune erreur 404 ou 401 dans les logs
- [ ] Messages d'erreur spécifiques si problème persistant
