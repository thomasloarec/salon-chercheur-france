# Debug Guide: HubSpot OAuth Callback

## Vue d'ensemble

Guide de diagnostic pour résoudre les erreurs 500/400 du callback HubSpot OAuth.

## Activation du mode debug

### Front-end
Ajouter `?oauthDebug=1` à l'URL de callback pour activer les logs détaillés :
```
https://lotexpo.com/oauth/hubspot/callback?code=...&state=...&oauthDebug=1
```

### Edge Function
Les logs structurés incluent un champ `stage` pour identifier précisément où l'erreur se produit.

## Contrat d'API

### Requête attendue (POST)
```json
{
  "provider": "hubspot",
  "code": "authorization_code_from_hubspot", 
  "state": "user_id_or_unauth_session"
}
```

### Réponse de succès
```json
{
  "success": true,
  "provider": "hubspot",
  "message": "HubSpot OAuth connection established successfully",
  "user_id": "uuid",
  "email": "user@example.com",
  "was_created": false
}
```

### Réponse d'erreur
```json
{
  "success": false,
  "stage": "token_exchange",
  "error": "Token exchange failed: 400 Bad Request", 
  "details": {
    "status": "BAD_AUTH_CODE",
    "message": "missing or unknown auth code"
  }
}
```

## Stages de diagnostic

### 1. `method_validation`
- **Erreur** : Méthode HTTP incorrecte
- **Solution** : Vérifier que le front envoie bien un POST

### 2. `input_validation`
- **Erreur** : JSON invalide, code manquant, ou code de test
- **Solution** : Vérifier le payload envoyé par le front

### 3. `environment_validation`
- **Erreur** : Secrets manquants (CLIENT_ID, CLIENT_SECRET, REDIRECT_URI)
- **Solution** : Vérifier les secrets Supabase

### 4. `token_exchange`
- **Erreur** : Échange de code échoué avec HubSpot
- **Solutions** :
  - Vérifier que `HUBSPOT_REDIRECT_URI` correspond exactement à l'URL déclarée dans HubSpot
  - Vérifier que le code n'est pas expiré (10 minutes max)
  - Vérifier le domaine HubSpot (EU vs US)

### 5. `user_handling`
- **Erreur** : Impossible de récupérer l'email ou de chercher l'utilisateur
- **Solution** : Vérifier les permissions de l'API HubSpot et la base Supabase

### 6. `user_creation`
- **Erreur** : Échec de création d'un nouvel utilisateur
- **Solution** : Vérifier les permissions Supabase auth

### 7. `token_encryption`
- **Erreur** : Échec de chiffrement des tokens
- **Solution** : Vérifier que pgcrypto est activé et que la clé de chiffrement est définie

### 8. `database_storage`
- **Erreur** : Échec de sauvegarde en base
- **Solution** : Vérifier la table `user_crm_connections` et les permissions RLS

## Test manuel avec curl

### Test de validation d'input
```bash
curl -i -X POST https://vxivdvzzhebobveedxbj.supabase.co/functions/v1/oauth-hubspot-callback \
  -H "Content-Type: application/json" \
  -d '{"provider":"hubspot","code":"TEST","state":"TEST"}'
```

**Attendu** : 400 avec `stage: "input_validation"` et message sur code de test.

### Test avec code invalide
```bash
curl -i -X POST https://vxivdvzzhebobveedxbj.supabase.co/functions/v1/oauth-hubspot-callback \
  -H "Content-Type: application/json" \
  -d '{"provider":"hubspot","code":"invalid_code","state":"test_user"}'
```

**Attendu** : 400 avec `stage: "token_exchange"` et erreur HubSpot BAD_AUTH_CODE.

### Test CORS
```bash
curl -i -X OPTIONS https://vxivdvzzhebobveedxbj.supabase.co/functions/v1/oauth-hubspot-callback
```

**Attendu** : 204 avec headers CORS appropriés.

## Variables d'environnement requises

```bash
HUBSPOT_CLIENT_ID=your_client_id
HUBSPOT_CLIENT_SECRET=your_client_secret  
HUBSPOT_REDIRECT_URI=https://lotexpo.com/oauth/hubspot/callback
HUBSPOT_DOMAIN=app-eu1.hubspot.com  # ou app.hubspot.com pour US
```

## Checklist de résolution

### ✅ Erreurs fréquentes

1. **400 "BAD_AUTH_CODE"**
   - [ ] Vérifier que `HUBSPOT_REDIRECT_URI` correspond exactement à l'URL HubSpot
   - [ ] Vérifier que le code n'est pas expiré (max 10 min après autorisation)
   - [ ] Tester avec un nouveau code d'autorisation

2. **CORS errors**
   - [ ] Vérifier que l'origine est `https://lotexpo.com`
   - [ ] Vérifier les headers CORS dans la réponse OPTIONS

3. **500 "token_encryption"**
   - [ ] Vérifier que pgcrypto est activé : `SELECT pgp_sym_encrypt('test', 'key');`
   - [ ] Vérifier la variable `CRM_ENCRYPTION_KEY`

4. **500 "database_storage"**
   - [ ] Vérifier que la table `user_crm_connections` existe
   - [ ] Vérifier les politiques RLS sur cette table

### 🔍 Debug pas à pas

1. **Reproduire l'erreur** avec `?oauthDebug=1`
2. **Identifier le stage** dans la réponse JSON d'erreur  
3. **Consulter les logs** Edge Function correspondants
4. **Appliquer la solution** selon le stage identifié
5. **Tester à nouveau** le flow complet

## Logs utiles

### Logs de succès type
```
🔄 HubSpot callback initiated
📊 Request details: { method: "POST", origin: "https://lotexpo.com" }
🔧 Environment check: { hubspotClientId: "set", ... }
📋 Callback parameters: { code: "***", state: "***", provider: "hubspot" }
🔐 Real HubSpot OAuth callback - exchanging code for tokens
📡 HubSpot API response: { status: 200, statusText: "OK", ok: true }
✅ HubSpot token exchange successful
📧 HubSpot user email: ***@***.com
👤 Authenticated user flow, user ID: uuid
✅ HubSpot tokens stored successfully for user: uuid
```

### Logs d'erreur type
```
❌ HubSpot token exchange failed: {
  status: 400,
  statusText: "Bad Request", 
  error: { status: "BAD_AUTH_CODE", message: "missing or unknown auth code" }
}
```

## Support

En cas de problème persistant, fournir :
- URL complète de test avec `?oauthDebug=1`
- Réponse JSON d'erreur avec le champ `stage`
- Logs Edge Function correspondants (masquer les données sensibles)
- Configuration HubSpot (scopes, redirect URI)