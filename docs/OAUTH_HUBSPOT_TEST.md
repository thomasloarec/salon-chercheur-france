# Guide de Test HubSpot OAuth

## Page de Test

### URL de Test
- **Normal**: `/oauth/hubspot/test`
- **Debug**: `/oauth/hubspot/test?oauthDebug=1`

### Fonctionnalités

1. **Bouton "Connecter HubSpot (test)"**:
   - Génère un state OAuth sécurisé (UUID)
   - Pose un cookie `oauth_state` avec les bonnes options
   - Sauvegarde en localStorage (fallback)
   - Ouvre HubSpot OAuth (popup ou même onglet)
   - Stocke l'URL de retour dans sessionStorage

2. **Mode Debug** (`?oauthDebug=1`):
   - Diagnostic en temps réel
   - Affichage de l'URL d'autorisation complète
   - État des cookies/localStorage
   - Pas de redirection automatique

## Flow de Test Complet

### 1. Préparation
```
1. Ouvrir DevTools → Application → Storage
2. Vider cookies et localStorage si nécessaire
3. Naviguer vers /oauth/hubspot/test?oauthDebug=1
```

### 2. Initiation OAuth
```
1. Cliquer "Connecter HubSpot (test)"
2. Vérifier dans DevTools:
   - Cookie: oauth_state=... (Domain: .lotexpo.com)
   - localStorage: oauth_state = UUID
3. HubSpot s'ouvre (popup ou onglet)
```

### 3. Callback HubSpot
```
1. Compléter l'autorisation HubSpot
2. Retour sur /oauth/hubspot/callback?code=...&state=...
3. Vérifier diagnostic (mode debug):
   - cookie_state_present: true
   - local_state_present: true  
   - header_state_present: true
   - state_from_url: visible
```

### 4. Edge Function
```
1. POST vers oauth-hubspot-callback
2. Headers vérifiés:
   - Content-Type: application/json
   - X-OAuth-State: [state du cookie]
3. Réponse attendue: {"success":true,"connected":true}
```

### 5. Retour Final
```
1. Nettoyage automatique (cookie + localStorage)
2. Si popup: retour vers page de test
3. Si onglet: redirection vers page de test
4. Succès affiché
```

## Diagnostic des Erreurs

### Cookie manquant
- **Cause**: Problème de domaine (.lotexpo.com)
- **Solution**: Vérifier configuration cookie

### Local State absent
- **Cause**: localStorage bloqué/effacé
- **Solution**: Autoriser localStorage pour le site

### Header State manquant  
- **Cause**: Cookie + localStorage perdus
- **Solution**: En debug, fallback sur URL state

### CSRF State Error
- **Cause**: État manquant ou incorrect
- **Solution**: Vérifier génération/stockage état

## Architecture

### Pas d'Apollo
- Page totalement indépendante
- Aucun useQuery ou provider GraphQL
- Seulement fetch() vers Edge Function

### Stockage État
1. **Cookie principal**: Domain=.lotexpo.com, Secure, SameSite=Lax
2. **Fallback localStorage**: Pour debug/récupération
3. **Header X-OAuth-State**: Transmission sécurisée

### Redirection
- **sessionStorage.oauth_return_to**: URL de retour
- **window.opener**: Gestion popup
- **Fallback**: Redirection normale

## Commandes de Test

### Test Basic
```bash
# 1. Ouvrir la page de test
open https://lotexpo.com/oauth/hubspot/test

# 2. Cliquer le bouton
# 3. Compléter HubSpot OAuth
# 4. Vérifier succès
```

### Test Debug
```bash  
# 1. Ouvrir avec debug
open https://lotexpo.com/oauth/hubspot/test?oauthDebug=1

# 2. Examiner diagnostic avant/après
# 3. Vérifier l'URL générée (redirect_uri correct)
# 4. Suivre le flow complet
```

## Critères de Validation

✅ **Cookie oauth_state** pose correctement (.lotexpo.com)  
✅ **localStorage fallback** fonctionne  
✅ **URL authorize** contient `/oauth/hubspot/callback` (pas `/api`)  
✅ **Header X-OAuth-State** envoyé au serveur  
✅ **Réponse JSON** success:true en cas de succès  
✅ **Diagnostic debug** affiche tous les flags  
✅ **Nettoyage automatique** après succès/erreur  
✅ **Retour sur page test** après completion  

## Sécurité

- **State CSRF**: UUID sécurisé généré côté client
- **Cookie sécurisé**: Secure + SameSite=Lax + Domain
- **Validation serveur**: Comparaison header vs URL state
- **Nettoyage**: Suppression état après usage
- **Pas d'exposition**: Secrets côté serveur uniquement