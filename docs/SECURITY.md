# Guide de Sécurité - Chiffrement des Tokens CRM

## Vue d'ensemble

Cette application utilise un système de chiffrement symétrique pour protéger les tokens OAuth des intégrations CRM en base de données. Les tokens ne sont jamais stockés en clair et sont chiffrés à l'aide de l'extension PostgreSQL `pgcrypto`.

## Architecture de Sécurité

### 1. Chiffrement des Tokens

- **Extension utilisée** : `pgcrypto` de PostgreSQL
- **Algorithme** : Chiffrement symétrique via `pgp_sym_encrypt` / `pgp_sym_decrypt`
- **Clé de chiffrement** : Stockée dans la variable d'environnement `CRM_ENCRYPTION_KEY`

### 2. Schéma de Base de Données

La table `user_crm_connections` contient :
- `access_token_enc` : Token d'accès chiffré (bytea NOT NULL)
- `refresh_token_enc` : Token de rafraîchissement chiffré (bytea, nullable)
- Plus de colonnes `access_token` et `refresh_token` en clair

### 3. Flux de Sécurité

#### Stockage des Tokens (OAuth Callbacks)
1. L'utilisateur autorise l'accès à son CRM
2. L'Edge Function reçoit les tokens OAuth
3. Les tokens sont immédiatement chiffrés avec `pgp_sym_encrypt`
4. Seuls les tokens chiffrés sont stockés en base

#### Utilisation des Tokens
1. L'application récupère les tokens chiffrés depuis la base
2. Une Edge Function déchiffre les tokens avec `pgp_sym_decrypt`
3. Les tokens déchiffrés sont utilisés pour les API CRM
4. Les tokens ne transitent jamais en clair côté client

## Configuration des Secrets

### Variable d'Environnement Requise

```bash
CRM_ENCRYPTION_KEY=your-super-secure-encryption-key-min-32-chars
```

⚠️ **IMPORTANT** : Cette clé doit être :
- D'au moins 32 caractères
- Générée aléatoirement (ex: `openssl rand -base64 32`)
- Identique sur tous les environnements pour la même base de données
- Sauvegardée de manière sécurisée

### Configuration dans Supabase

1. Aller dans **Settings > Edge Functions**
2. Ajouter la variable `CRM_ENCRYPTION_KEY`
3. Redémarrer les Edge Functions si nécessaire

## Rotation de la Clé de Chiffrement

### Procédure de Rotation

1. **Préparation**
   ```sql
   -- Créer une nouvelle colonne temporaire
   ALTER TABLE user_crm_connections 
   ADD COLUMN access_token_enc_new bytea,
   ADD COLUMN refresh_token_enc_new bytea;
   ```

2. **Re-chiffrement avec la nouvelle clé**
   ```sql
   -- Déchiffrer avec l'ancienne clé et re-chiffrer avec la nouvelle
   UPDATE user_crm_connections 
   SET 
     access_token_enc_new = pgp_sym_encrypt(
       pgp_sym_decrypt(access_token_enc, 'OLD_KEY'), 
       'NEW_KEY'
     ),
     refresh_token_enc_new = CASE 
       WHEN refresh_token_enc IS NOT NULL 
       THEN pgp_sym_encrypt(
         pgp_sym_decrypt(refresh_token_enc, 'OLD_KEY'), 
         'NEW_KEY'
       )
       ELSE NULL 
     END;
   ```

3. **Basculement atomique**
   ```sql
   BEGIN;
   
   -- Renommer les colonnes
   ALTER TABLE user_crm_connections 
   RENAME COLUMN access_token_enc TO access_token_enc_old;
   ALTER TABLE user_crm_connections 
   RENAME COLUMN refresh_token_enc TO refresh_token_enc_old;
   ALTER TABLE user_crm_connections 
   RENAME COLUMN access_token_enc_new TO access_token_enc;
   ALTER TABLE user_crm_connections 
   RENAME COLUMN refresh_token_enc_new TO refresh_token_enc;
   
   COMMIT;
   ```

4. **Mise à jour de la variable d'environnement**
   - Mettre à jour `CRM_ENCRYPTION_KEY` avec la nouvelle clé
   - Redémarrer les Edge Functions

5. **Nettoyage**
   ```sql
   -- Après validation, supprimer les anciennes colonnes
   ALTER TABLE user_crm_connections 
   DROP COLUMN access_token_enc_old,
   DROP COLUMN refresh_token_enc_old;
   ```

### Fréquence de Rotation Recommandée

- **Production** : Tous les 6 mois minimum
- **Après un incident de sécurité** : Immédiatement
- **Changement d'équipe** : Selon les politiques de l'entreprise

## Edge Functions de Sécurité

### `decrypt-crm-tokens`
- **But** : Déchiffrer les tokens pour utilisation
- **Authentification** : JWT obligatoire
- **Accès** : Utilisateur propriétaire uniquement

### `update-crm-tokens`
- **But** : Chiffrer et mettre à jour les tokens
- **Authentification** : JWT obligatoire
- **Accès** : Utilisateur propriétaire uniquement

## Monitoring et Audit

### Logs de Sécurité

Tous les accès aux tokens sont loggés avec :
- ID utilisateur
- Provider CRM
- Timestamp
- Type d'opération (encrypt/decrypt/update)

### Alertes Recommandées

- Échecs de déchiffrement répétés
- Tentatives d'accès aux tokens d'autres utilisateurs
- Utilisation de la clé de développement en production

## Bonnes Pratiques

### Développement
- Utiliser une clé de test différente de la production
- Ne jamais commiter les clés dans le code source
- Tester la rotation en local avant la production

### Production
- Surveiller les erreurs de déchiffrement
- Sauvegarder la clé de chiffrement de manière sécurisée
- Documenter toute rotation dans les logs d'audit

### Récupération d'Urgence
- Avoir un plan de restauration des tokens
- Tester régulièrement la procédure de rotation
- Maintenir une copie de sauvegarde chiffrée de la clé

## Compliance et Réglementations

Cette implémentation répond aux exigences de :
- **RGPD** : Chiffrement des données personnelles
- **SOC 2** : Protection des tokens d'accès
- **OWASP** : Stockage sécurisé des secrets

Pour plus d'informations sur la sécurité, consultez la [documentation Supabase Security](https://supabase.com/docs/guides/auth/auth-deep-dive/auth-deep-dive).