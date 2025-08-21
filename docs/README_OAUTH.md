# Configuration OAuth HubSpot - Page de Callback

## Vue d'ensemble

Configuration OAuth HubSpot utilisant une page React front-end pour gérer le callback et transmettre les données à l'Edge Function Supabase.

## Configuration OAuth HubSpot

### URLs de callback

- **URL de callback propre** : `https://lotexpo.com/oauth/hubspot/callback`
- **Edge Function Supabase** : `https://vxivdvzzhebobveedxbj.supabase.co/functions/v1/oauth-hubspot-callback`

### Mécanisme

1. HubSpot redirige vers `https://lotexpo.com/oauth/hubspot/callback?code=...&state=...`
2. La page React récupère les paramètres et POST vers l'Edge Function
3. L'Edge Function traite l'échange de tokens et la création/association de compte

### Variables d'environnement requises

```bash
HUBSPOT_REDIRECT_URI=https://lotexpo.com/oauth/hubspot/callback
HUBSPOT_DOMAIN=app-eu1.hubspot.com  # ou app.hubspot.com pour US
HUBSPOT_CLIENT_ID=votre_client_id
HUBSPOT_CLIENT_SECRET=votre_client_secret
HUBSPOT_APP_ID=votre_app_id
```

## Vérification du fonctionnement

### Test de la redirection

```bash
# Doit renvoyer le contenu de la page de callback React
curl -i "https://lotexpo.com/oauth/hubspot/callback?code=TEST&state=TEST"
```

### Test du flow OAuth complet

1. Cliquer sur "Connecter HubSpot" dans l'interface
2. Vérifier l'URL d'autorisation générée dans les logs
3. Autoriser l'application sur HubSpot
4. Vérifier la redirection sans erreur 404
5. Vérifier la création/mise à jour des tokens en base

### Debug mode

Ajouter `?oauthDebug=1` à l'URL pour afficher les logs de debug dans la console de la page.

## Configuration HubSpot App

Dans la console développeur HubSpot :

1. **Redirect URL** : `https://lotexpo.com/oauth/hubspot/callback`
2. **Scopes requis** :
   - `oauth` (obligatoire)
   - `crm.objects.companies.read`
   - `crm.objects.contacts.read`

## En cas de changement de domaine

1. Mettre à jour `HUBSPOT_REDIRECT_URI` dans les secrets Supabase
2. Mettre à jour l'URL de redirection dans l'app HubSpot
3. Vérifier que la page de callback fonctionne sur le nouveau domaine

## Sécurité

- Les secrets ne sont jamais exposés dans les logs front-end
- Les tokens sont chiffrés en base via pgcrypto
- La page de callback utilise HTTPS uniquement
- Les query parameters sont transmis via POST sécurisé

## Dépannage

### Erreur 404 sur le callback

1. Vérifier que la route `/oauth/hubspot/callback` est définie dans App.tsx
2. Vérifier que la page `OAuthCallback.tsx` existe
3. Vérifier que l'URL HubSpot correspond exactement

### Tokens non créés

1. Vérifier les logs de l'Edge Function `oauth-hubspot-callback`
2. Vérifier que les secrets Supabase sont configurés
3. Vérifier la configuration des scopes HubSpot

### URL OAuth invalide

1. Activer le mode debug avec `?oauthDebug=1`
2. Comparer l'URL générée avec celle de la console HubSpot
3. Vérifier `HUBSPOT_DOMAIN` et `HUBSPOT_REDIRECT_URI`