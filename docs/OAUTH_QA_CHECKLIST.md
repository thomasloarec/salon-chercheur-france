# Checklist QA - Configuration OAuth HubSpot

## ✅ Pré-déploiement (Validation locale)

### 1. Configuration de la page de callback

- [ ] **Route** : Route `/oauth/hubspot/callback` ajoutée dans `App.tsx`
- [ ] **Page** : Page `OAuthCallback.tsx` fonctionne pour HubSpot
- [ ] **Documentation** : `docs/README_OAUTH.md` créé avec la nouvelle configuration

### 2. Test de l'Edge Function oauth-hubspot

```bash
# Test en mode debug (remplacer par votre URL de développement)
curl -X POST "http://localhost:54321/functions/v1/oauth-hubspot?oauthDebug=1" \
  -H "Content-Type: application/json" \
  -d "{}"
```

**Attendu :**
- ✅ Réponse JSON avec `installUrl` présente
- ✅ Log `[DEBUG MODE]` visible avec URL OAuth complète
- ✅ URL contient `app-eu1.hubspot.com` (ou `app.hubspot.com`)
- ✅ URL contient `redirect_uri=https://lotexpo.com/oauth/hubspot/callback`

### A. Test de la page de callback

1. **Vérifier que la page de callback est accessible :**
   ```bash
   # Doit afficher la page de callback React (pas une 404)
   curl -i "https://lotexpo.com/oauth/hubspot/callback?code=TEST&state=TEST"
   ```

2. **Avec le mode debug activé :**
   ```bash
   # Doit afficher les logs de debug dans la console de la page
   https://lotexpo.com/oauth/hubspot/callback?code=TEST&state=TEST&oauthDebug=1
   ```

### 3. Variables d'environnement

Vérifier dans Supabase Edge Functions secrets :
- [ ] `HUBSPOT_DOMAIN` = `app-eu1.hubspot.com`
- [ ] `HUBSPOT_REDIRECT_URI` = `https://lotexpo.com/oauth/hubspot/callback`
- [ ] `HUBSPOT_CLIENT_ID` présent
- [ ] `HUBSPOT_CLIENT_SECRET` présent
- [ ] `HUBSPOT_APP_ID` présent

## ✅ Post-déploiement (Validation production)

### 1. Test de la page de callback

```bash
# Test d'accès à la page (doit être fait en HTTPS sur le domaine final)
curl -i "https://lotexpo.com/oauth/hubspot/callback?code=TEST&state=TEST"
```

**Attendu :**
- ✅ Status: `200 OK` (page React chargée)
- ✅ Pas d'erreur 404
- ✅ Contenu HTML de la page de callback

### 2. Configuration HubSpot App

Dans la console développeur HubSpot :
- [ ] **Redirect URL** : `https://lotexpo.com/oauth/hubspot/callback`
- [ ] **Scopes requis** :
  - [ ] `oauth` (obligatoire)
  - [ ] `crm.objects.companies.read`
  - [ ] `crm.objects.contacts.read`

### 3. Test du flux OAuth complet

#### A. Utilisateur connecté
1. [ ] Se connecter à l'application
2. [ ] Aller sur la page CRM Integrations
3. [ ] Cliquer "Connecter HubSpot"
4. [ ] ✅ Popup HubSpot s'ouvre (pas de 404)
5. [ ] ✅ URL contient `app-eu1.hubspot.com`
6. [ ] ✅ URL contient `redirect_uri=https://lotexpo.com/oauth/hubspot/callback`
7. [ ] Autoriser l'application sur HubSpot
8. [ ] ✅ Redirection vers la page de callback React
9. [ ] ✅ Message de succès affiché
10. [ ] ✅ Statut "Connecté" visible dans l'interface

#### B. Utilisateur non connecté
1. [ ] Ouvrir navigation privée
2. [ ] Répéter les étapes 2-8 ci-dessus
3. [ ] ✅ Création de compte automatique ou liaison selon le flux implémenté

### 4. Vérification de la base de données

```sql
-- Vérifier que les tokens sont chiffrés
SELECT 
    provider, 
    user_id, 
    LEFT(encrypted_access_token, 20) || '...' as token_preview,
    created_at 
FROM user_crm_connections 
WHERE provider = 'hubspot'
ORDER BY created_at DESC 
LIMIT 5;
```

**Attendu :**
- ✅ Tokens commencent par des caractères chiffrés (pas de texte en clair)
- ✅ `user_id` présent et valide
- ✅ `created_at` récent

### 5. Logs de vérification

#### Edge Function oauth-hubspot
```
🔍 HubSpot OAuth URL construite: {
  domain: "app-eu1.hubspot.com",
  clientId: "d5e83145-...",
  redirectUri: "https://lotexpo.com/oauth/hubspot/callback",
  requiredScopes: ["oauth", "crm.objects.companies.read", "crm.objects.contacts.read"]
}
```

#### Edge Function oauth-hubspot-callback
- [ ] ✅ Logs de réception du code via POST
- [ ] ✅ Logs d'échange de tokens réussi
- [ ] ✅ Logs de sauvegarde en base

#### Page de callback (console navigateur)
- [ ] ✅ Logs de récupération des paramètres code/state
- [ ] ✅ Logs d'appel POST vers l'Edge Function
- [ ] ✅ Logs de réponse de succès

## ❌ Problèmes courants et solutions

### 404 sur le callback
- Vérifier que la route `/oauth/hubspot/callback` est dans App.tsx
- Vérifier que le composant `OAuthCallback` est correctement importé
- Vérifier que l'URL HubSpot correspond exactement

### Tokens non créés
- Vérifier les logs de l'Edge Function `oauth-hubspot-callback`
- Vérifier la configuration des secrets Supabase
- Vérifier la configuration des scopes HubSpot

### URL OAuth invalide
- Activer le mode debug avec `?oauthDebug=1`
- Comparer l'URL générée avec celle de la console HubSpot
- Vérifier `HUBSPOT_DOMAIN` et `HUBSPOT_REDIRECT_URI`

### Page de callback ne fonctionne pas
- Vérifier la console du navigateur pour les erreurs JavaScript
- Vérifier que les CORS sont configurés dans l'Edge Function
- Vérifier que les paramètres sont correctement transmis

## 🔒 Sécurité validée

- [ ] ✅ Secrets jamais exposés dans les logs front-end
- [ ] ✅ Tokens chiffrés en base avec pgcrypto
- [ ] ✅ HTTPS obligatoire sur toutes les URLs
- [ ] ✅ POST sécurisé vers l'Edge Function
- [ ] ✅ Pas d'impact sur le SEO ou le cache

## 📋 Validation finale

- [ ] **Développement** : Tous les tests pré-déploiement passés
- [ ] **Staging** : Tous les tests post-déploiement passés
- [ ] **Production** : Validation manuelle du flux complet
- [ ] **Documentation** : README_OAUTH.md à jour
- [ ] **Monitoring** : Logs surveillés pendant 24h

**Date de validation :** _______________
**Validé par :** _______________
**Prêt pour production :** ☐ Oui ☐ Non

## 🚀 Déploiement

**ATTENTION :** Ne pas déployer en production tant que cette checklist n'est pas 100% validée.

### Étapes de déploiement
1. [ ] Valider la checklist pré-déploiement
2. [ ] Déployer sur staging
3. [ ] Valider la checklist post-déploiement sur staging
4. [ ] Déployer en production
5. [ ] Valider le flux complet en production
6. [ ] Surveiller les logs pendant 24h