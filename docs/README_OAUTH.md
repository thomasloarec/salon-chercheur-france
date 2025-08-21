# Configuration OAuth HubSpot - Redirection de Callback

## Vue d'ensemble

Ce document explique la configuration de redirection pour l'URL de callback OAuth HubSpot propre.

**URL publique** : `https://lotexpo.com/api/oauth/hubspot/callback`
**URL de destination** : `https://vxivdvzzhebobveedxbj.supabase.co/functions/v1/oauth-hubspot-callback`

## Configuration par environnement d'hébergement

### Vercel (Recommandé)

Le fichier `vercel.json` à la racine du projet contient la configuration de rewrite :

```json
{
  "rewrites": [
    {
      "source": "/api/oauth/hubspot/callback",
      "destination": "https://vxivdvzzhebobveedxbj.supabase.co/functions/v1/oauth-hubspot-callback"
    }
  ]
}
```

Les rewrites Vercel conservent automatiquement tous les query parameters.

### Netlify (Alternative)

Le fichier `public/_redirects` contient la configuration de redirection :

```
/api/oauth/hubspot/callback   https://vxivdvzzhebobveedxbj.supabase.co/functions/v1/oauth-hubspot-callback   307!
```

Le code `307!` force une redirection temporaire en préservant les query parameters.

### Cloudflare Pages

Créer un fichier `public/_redirects` :

```
/api/oauth/hubspot/callback https://vxivdvzzhebobveedxbj.supabase.co/functions/v1/oauth-hubspot-callback 307
```

### Nginx

Configuration à ajouter dans le bloc server :

```nginx
location = /api/oauth/hubspot/callback {
  return 307 https://vxivdvzzhebobveedxbj.supabase.co/functions/v1/oauth-hubspot-callback$is_args$args;
}
```

## Variables d'environnement

Dans la configuration Supabase Edge Functions :

- `HUBSPOT_REDIRECT_URI` = `https://lotexpo.com/api/oauth/hubspot/callback`
- `HUBSPOT_DOMAIN` = `app-eu1.hubspot.com` (EU) ou `app.hubspot.com` (US)

## Configuration HubSpot App

Dans la console développeur HubSpot :

1. **Redirect URL** : `https://lotexpo.com/api/oauth/hubspot/callback`
2. **Scopes requis** :
   - `oauth` (obligatoire)
   - `crm.objects.companies.read`
   - `crm.objects.contacts.read`

## Tests de validation

### 1. Test de redirection

```bash
curl -I "https://lotexpo.com/api/oauth/hubspot/callback?code=TEST&state=TEST"
```

Attendu : Redirection 307 vers l'Edge Function avec query params préservés.

### 2. Test du flow OAuth complet

1. Cliquer sur "Connecter HubSpot" dans l'interface
2. Vérifier l'URL d'autorisation générée dans les logs
3. Autoriser l'application sur HubSpot
4. Vérifier la redirection sans erreur 404
5. Vérifier la création/mise à jour des tokens en base

### 3. Debug mode

Ajouter `?oauthDebug=1` à l'URL pour afficher l'URL OAuth complète dans la console.

## Changement de domaine

Pour changer de domaine :

1. Mettre à jour `HUBSPOT_REDIRECT_URI` dans les secrets Supabase
2. Mettre à jour la Redirect URL dans la console HubSpot
3. Mettre à jour l'URL de destination dans le fichier de redirection
4. Redéployer l'application

## Sécurité

- Les secrets ne sont jamais exposés dans les logs
- Les tokens sont chiffrés en base via pgcrypto
- La redirection préserve l'intégrité des query parameters
- Aucun impact sur le SEO ou le cache des autres pages

## Dépannage

### Erreur 404 sur le callback

1. Vérifier que le fichier de redirection est déployé
2. Vérifier la configuration dans la console de l'hébergeur
3. Vérifier que l'URL HubSpot correspond exactement

### Tokens non créés

1. Vérifier les logs de l'Edge Function `oauth-hubspot-callback`
2. Vérifier que les secrets Supabase sont configurés
3. Vérifier la configuration des scopes HubSpot

### URL OAuth invalide

1. Activer le mode debug avec `?oauthDebug=1`
2. Comparer l'URL générée avec celle de la console HubSpot
3. Vérifier `HUBSPOT_DOMAIN` et `HUBSPOT_REDIRECT_URI`