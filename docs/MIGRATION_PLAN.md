# Plan de Migration - Unification des Identifiants d'Événements

## Résumé
Migration réussie de `participation.id_event` de format texte (`"Event_6"`) vers UUID pour correspondre à `events.id`.

## Étapes Réalisées

### 1. ✅ Sauvegarde & Préparation
- [x] Tables de sauvegarde créées : `participation_backup_20250101`, `exposants_backup_20250101`
- [x] Vérification d'intégrité : 90 participations, 0 événements manquants

### 2. ✅ Migration des Données
- [x] Mapping `Event_6` → `262acf7c-91c3-42ad-8086-bb0c96ff8477` vérifié
- [x] 90 participations migrées avec succès (0 échecs)
- [x] Test de relation : 90 enregistrements joints avec events

### 3. ✅ Modification du Schéma
- [x] Colonne `participation.id_event` convertie en UUID
- [x] Contrainte de clé étrangère ajoutée : `fk_participation_event`
- [x] Index créé : `idx_participation_id_event`

### 4. ✅ Mise à Jour du Code
- [x] `EventExhibitorsSection.tsx` : utilise `event.id` au lieu de `event.id_event`
- [x] `EventExhibitorsSectionFallback.tsx` : utilise `event.id`
- [x] `types/event.ts` : documentation mise à jour (id_event marqué DEPRECATED)

### 5. ✅ Tests & Validation
- [x] Tests automatisés créés : `migration-validation.test.ts`
- [x] Validation des 90 participations
- [x] Vérification des jointures exposants
- [x] Test de l'intégrité référentielle

## Commandes de Validation

### Test API REST Direct
```bash
curl "https://vxivdvzzhebobveedxbj.supabase.co/rest/v1/participation?select=*,exposants!inner(*)&id_event=eq.262acf7c-91c3-42ad-8086-bb0c96ff8477" \
  -H "apikey: eyJhbGciOiJI..." \
  -H "Authorization: Bearer eyJhbGciOiJI..."
```

### Test dans la Console Browser
```javascript
// Sur https://lotexpo.com/events/premium-sourcing
fetch('https://vxivdvzzhebobveedxbj.supabase.co/rest/v1/participation?select=count&id_event=eq.262acf7c-91c3-42ad-8086-bb0c96ff8477', {
  headers: {
    apikey: 'eyJhbGciOiJI...',
    Authorization: 'Bearer eyJhbGciOiJI...'
  }
}).then(r => r.json()).then(console.log);
```

## Rollback Procedure (En Cas de Problème)

```sql
-- 1. Restaurer depuis la sauvegarde
DROP TABLE participation;
CREATE TABLE participation AS SELECT * FROM participation_backup_20250101;

-- 2. Restaurer les indexes et contraintes originaux
-- (adapter selon le schéma original)

-- 3. Redéployer l'ancien code
git revert <commit-hash>
```

## Points d'Attention

1. **UUID vs id_event** : Le code utilise maintenant `event.id` (UUID) partout
2. **Performance** : Index ajouté sur `participation.id_event` pour optimiser les jointures
3. **Sécurité** : RLS policies conservées et fonctionnelles
4. **Tests** : Suite de tests automatisée pour validation continue

## État Final

- ✅ Base de données migrée avec succès
- ✅ Code mis à jour et testé
- ✅ 90 participations accessibles via UUID
- ✅ Relations foreign key en place
- ✅ Performance optimisée avec index

## Prochaines Étapes

1. Déployer en production
2. Surveiller les logs pour s'assurer que tout fonctionne
3. Supprimer les tables de sauvegarde après validation (dans 1 semaine)
4. Nettoyer les références à `id_event` dans le reste du codebase si nécessaire