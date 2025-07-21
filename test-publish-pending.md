
# Test de la fonction publish-pending

## Test local avec Supabase CLI

### 1. Démarrer les fonctions localement
```bash
supabase functions serve
```

### 2. Tester la fonction
```bash
# Test avec un ID d'événement valide
curl -v http://localhost:54321/functions/v1/publish-pending \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -d '{"id_event":"Event_7"}'

# Test avec un ID manquant (doit retourner erreur 400)
curl -v http://localhost:54321/functions/v1/publish-pending \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -d '{}'

# Test avec un ID inexistant (doit retourner erreur 404)
curl -v http://localhost:54321/functions/v1/publish-pending \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -d '{"id_event":"INEXISTANT_ID"}'
```

## Test en production

### Via l'interface admin
1. Aller sur `/admin`
2. Chercher la section "Événements en attente de publication"
3. Cliquer sur le bouton "Publier" d'un événement approuvé
4. Vérifier les logs dans la console développeur

### Via curl en production
```bash
curl -v https://vxivdvzzhebobveedxbj.supabase.co/functions/v1/publish-pending \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -d '{"id_event":"Event_7"}'
```

## Logs à surveiller

### Succès attendu
```
🔵 Début publication événement en attente
🔍 Recherche événement import avec ID: Event_7
✅ Événement import trouvé: 25th Euretina Congress
🔧 Événement mappé pour production: {...}
✅ Événement publié avec succès
✅ Événement supprimé de events_import
```

### Erreurs possibles
- `❌ ID événement manquant` → Vérifier le JSON envoyé
- `❌ Événement non trouvé` → Vérifier que l'ID existe et que status_event = 'Approved'
- `❌ Erreur upsert événement` → Vérifier la structure de données et les contraintes DB

## Vérification post-publication

1. Vérifier que l'événement apparaît dans la table `events` avec `visible = true`
2. Vérifier que l'événement a été supprimé de `events_import`
3. Vérifier que l'événement apparaît sur le site public
4. Vérifier les logs de la fonction edge pour tout problème
