
# Configuration des secrets Airtable pour Supabase Functions

## Vue d'ensemble

Ce projet utilise plusieurs **Supabase Edge Functions** qui nécessitent des variables d'environnement (secrets) pour se connecter à Airtable :

- `AIRTABLE_PAT` : Personal Access Token Airtable
- `AIRTABLE_BASE_ID` : ID de votre base Airtable  
- `EVENTS_TABLE_NAME` : Nom de la table des événements (défaut: "All_Events")
- `EXHIBITORS_TABLE_NAME` : Nom de la table des exposants (défaut: "All_Exposants")  
- `PARTICIPATION_TABLE_NAME` : Nom de la table de participation (défaut: "Participation")

---

## 🔧 Configuration initiale

### 1. Obtenir votre Personal Access Token (PAT)

1. Rendez-vous sur [Airtable Tokens](https://airtable.com/create/tokens)
2. Cliquez sur **"Create new token"**
3. Donnez un nom à votre token (ex: "SalonsPro Integration")
4. Configurez les **scopes** :
   - ✅ `data.records:read`
   - ✅ `data.records:write`
   - ✅ `schema.bases:read` (pour l'inspection)
5. Sélectionnez votre **base** dans "Access"
6. Cliquez sur **"Create token"**
7. **Copiez immédiatement** le token (il ne sera plus affiché)

### 2. Trouver votre Base ID

1. Ouvrez votre base Airtable
2. Dans l'URL, l'ID commence par `app` : `https://airtable.com/appXXXXXXXXXXXXXX/...`
3. Copiez cette valeur `appXXXXXXXXXXXXXX`

### 3. Configurer les secrets Supabase

Exécutez cette commande en remplaçant les valeurs :

```bash
supabase secrets set \
  AIRTABLE_PAT="votre_token_ici" \
  AIRTABLE_BASE_ID="appXXXXXXXXXXXXXX" \
  EVENTS_TABLE_NAME="All_Events" \
  EXHIBITORS_TABLE_NAME="All_Exposants" \
  PARTICIPATION_TABLE_NAME="Participation"
```

### 4. Redéployer les functions

```bash
supabase functions deploy --all
```

---

## 🔍 Diagnostic des erreurs

### Erreur 404 - "Table not found"

Cette erreur indique que soit votre Base ID, soit le nom d'une table est incorrect.

#### Étapes de diagnostic :

1. **Utilisez l'inspecteur intégré** :
   - Allez sur `/admin` dans votre app
   - Si vous voyez une erreur 404, cliquez sur **"Inspecter Airtable"**
   - Ouvrez la console du navigateur (F12)
   - Lisez les informations détaillées

2. **Vérifiez manuellement** :
   ```bash
   # Lister vos bases accessibles
   curl -H "Authorization: Bearer YOUR_PAT" \
        https://api.airtable.com/v0/meta/bases
   
   # Lister les tables d'une base
   curl -H "Authorization: Bearer YOUR_PAT" \
        https://api.airtable.com/v0/meta/bases/YOUR_BASE_ID/tables
   ```

3. **Solutions courantes** :
   - **Base ID incorrect** : Vérifiez l'URL de votre base Airtable
   - **Tables manquantes** : Créez les tables `All_Events`, `All_Exposants`, `Participation`
   - **Noms de tables différents** : Mettez à jour les secrets avec les vrais noms

#### Exemple de correction :

Si vos tables s'appellent `Events`, `Exhibitors`, `Participations` :

```bash
supabase secrets set \
  EVENTS_TABLE_NAME="Events" \
  EXHIBITORS_TABLE_NAME="Exhibitors" \
  PARTICIPATION_TABLE_NAME="Participations"

supabase functions deploy --all
```

### Erreur 401 - "Unauthorized"

**Cause** : Token Airtable invalide ou expiré

**Solutions** :
1. Vérifiez que votre PAT est encore valide sur [Airtable Tokens](https://airtable.com/create/tokens)
2. Régénérez un nouveau token si nécessaire
3. Mettez à jour le secret :
   ```bash
   supabase secrets set AIRTABLE_PAT="nouveau_token"
   supabase functions deploy --all
   ```

### Erreur "Variables manquantes"

**Cause** : Une ou plusieurs variables d'environnement ne sont pas configurées

**Solution** :
1. Listez les secrets actuels :
   ```bash
   supabase secrets list
   ```
2. Configurez les variables manquantes :
   ```bash
   supabase secrets set VARIABLE_MANQUANTE="valeur"
   ```
3. Redéployez :
   ```bash
   supabase functions deploy --all
   ```

---

## 🧪 Tests et validation

### Interface admin

L'interface admin (`/admin`) inclut plusieurs widgets de diagnostic :

1. **Widget de vérification finale** : Status global des secrets et connexions
2. **Tests de validation** : Vérifie la connectivité Airtable
3. **Vérification anti-doublons** : Teste les opérations CRUD

### Tests manuels

```bash
# Test de connectivité simple
curl -X POST \
  -H "Authorization: Bearer YOUR_SUPABASE_ANON_KEY" \
  -H "apikey: YOUR_SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"action":"LIST","table":"All_Events"}' \
  https://YOUR_PROJECT.supabase.co/functions/v1/airtable-proxy
```

### Logs détaillés

Les Edge Functions loggent toutes les étapes importantes. Consultez les logs :

1. Via Supabase Dashboard : `Functions > airtable-proxy > Logs`
2. Via CLI : `supabase functions serve --debug`

---

## 📋 Structure des tables Airtable requises

### All_Events
- `nom_event` (texte) : Nom de l'événement
- `date_debut` (date) : Date de début
- `date_fin` (date) : Date de fin
- `ville` (texte) : Ville
- `secteur` (multi-select) : Secteurs d'activité

### All_Exposants  
- `nom` (texte) : Nom de l'exposant
- `secteur` (multi-select) : Secteurs d'activité
- Autres champs selon vos besoins

### Participation
- `event_id` (lien vers All_Events) : L'événement
- `exposant_id` (lien vers All_Exposants) : L'exposant
- Autres champs de relation

---

## 🆘 Support

Si les problèmes persistent :

1. **Vérifiez les logs** des Edge Functions dans Supabase
2. **Utilisez l'inspecteur Airtable** intégré dans `/admin`
3. **Testez votre PAT** manuellement avec l'API Airtable
4. **Vérifiez les permissions** de votre token sur les bonnes bases/tables

---

## 🔄 Commandes de référence rapide

```bash
# Configuration complète
supabase secrets set \
  AIRTABLE_PAT="pat..." \
  AIRTABLE_BASE_ID="app..." \
  EVENTS_TABLE_NAME="All_Events" \
  EXHIBITORS_TABLE_NAME="All_Exposants" \
  PARTICIPATION_TABLE_NAME="Participation"

# Déploiement
supabase functions deploy --all

# Vérification
supabase secrets list

# Debug (optionnel)
supabase functions serve --debug
```
