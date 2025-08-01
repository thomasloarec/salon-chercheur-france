# Checklist QA - Migration des Identifiants d'Événements

## ✅ Tests Automatisés
- [ ] Exécuter les tests de migration : `npm run test src/utils/__tests__/migration-validation.test.ts`
- [ ] Vérifier que tous les tests passent (5/5)
- [ ] Confirmer que 90 participations sont accessibles

## ✅ Tests Manuel en Dev

### Test 1: API REST Direct
```bash
# Test du count
curl "https://vxivdvzzhebobveedxbj.supabase.co/rest/v1/participation?select=count&id_event=eq.262acf7c-91c3-42ad-8086-bb0c96ff8477" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# Résultat attendu: [{"count":90}]
```

### Test 2: Console Browser (DevTools)
Sur `https://lotexpo.com/events/premium-sourcing` :

```javascript
// Test 1: Count des participations
fetch('https://vxivdvzzhebobveedxbj.supabase.co/rest/v1/participation?select=count&id_event=eq.262acf7c-91c3-42ad-8086-bb0c96ff8477', {
  headers: {
    apikey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    Authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
  }
}).then(r => r.json()).then(data => console.log('Count:', data));

// Test 2: Données complètes avec jointure
fetch('https://vxivdvzzhebobveedxbj.supabase.co/rest/v1/participation?select=*,exposants!inner(*)&id_event=eq.262acf7c-91c3-42ad-8086-bb0c96ff8477&limit=5', {
  headers: {
    apikey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    Authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
  }
}).then(r => r.json()).then(data => console.log('Data:', data));
```

**Résultats attendus :**
- Count: `[{"count":90}]`
- Data: Array de 5 objets avec propriété `exposants`

## ✅ Tests Interface Utilisateur

### Test 3: Page Premium Sourcing
URL: `https://lotexpo.com/events/premium-sourcing`

**Vérifications :**
- [ ] La page se charge sans erreur
- [ ] Section "Exposants" visible
- [ ] Compte d'exposants affiché : "90 exposants"
- [ ] Liste des exposants s'affiche au clic sur "Voir tous les exposants"
- [ ] Pas d'erreur dans la console browser

### Test 4: Console Browser - Vérification des Logs
Dans DevTools → Console, rechercher :
- [ ] `✅ Données brutes de participation:` → Array[90]
- [ ] `📤 Exposants chargés via participation: 90`
- [ ] Aucune erreur `❌` relative aux exposants

### Test 5: Network Tab
Dans DevTools → Network :
- [ ] Requête à `/rest/v1/participation?select=...&id_event=eq.262acf7c-91c3-42ad-8086-bb0c96ff8477`
- [ ] Status: 200 OK
- [ ] Response body contient 90 enregistrements

## ✅ Tests Authentification

### Test 6: Utilisateur Non-Connecté
- [ ] Déconnexion de l'utilisateur
- [ ] Accès à `https://lotexpo.com/events/premium-sourcing`
- [ ] Exposants toujours visibles (RLS public read activé)

### Test 7: Utilisateur Connecté
- [ ] Connexion avec un compte utilisateur
- [ ] Accès à `https://lotexpo.com/events/premium-sourcing`
- [ ] Exposants visibles et fonctionnels

## ✅ Tests de Performance

### Test 8: Temps de Chargement
- [ ] Page se charge en < 3 secondes
- [ ] Requête exposants répond en < 1 seconde
- [ ] Pas de requêtes multiples redondantes

### Test 9: Erreurs JavaScript
- [ ] Aucune erreur JavaScript dans la console
- [ ] Aucune warning React dans la console
- [ ] Aucune erreur Supabase RLS

## ✅ Tests de Régression

### Test 10: Autres Pages d'Événements
Vérifier que les autres événements fonctionnent toujours :
- [ ] Page d'accueil : liste des événements
- [ ] Page événements : `/events`
- [ ] Recherche et filtres fonctionnels

### Test 11: Fonctionnalités Admin
Pour les utilisateurs admin :
- [ ] Modification d'événements
- [ ] Publication/dépublication
- [ ] Import Airtable

## 🚨 Rollback si Nécessaire

Si des tests échouent :

1. **Identifier le problème :**
   - Erreur de données ? → Vérifier la migration SQL
   - Erreur de code ? → Revenir au code précédent
   - Erreur RLS ? → Vérifier les permissions

2. **Procédure de rollback :**
   ```sql
   -- Restaurer la table
   DROP TABLE participation;
   CREATE TABLE participation AS SELECT * FROM participation_backup_20250101;
   -- Restaurer les index originaux
   ```

3. **Revenir au code précédent :**
   ```bash
   git revert HEAD~1  # ou le commit spécifique
   ```

## ✅ Validation Finale

- [ ] Tous les tests automatisés passent
- [ ] Tous les tests manuels validés
- [ ] Performance acceptable
- [ ] Aucune régression détectée
- [ ] Équipe formée sur les changements

**Signature QA:** _________________ **Date:** _________________

**Notes supplémentaires:**
_________________________________________________________________
_________________________________________________________________