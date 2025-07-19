
-- Vérifier directement s'il y a des liaisons pour le secteur "Santé & Médical"
SELECT 
  es.event_id,
  e.nom_event,
  e.ville,
  e.date_debut
FROM event_sectors es
JOIN events e ON e.id = es.event_id
WHERE es.sector_id = '550e8400-e29b-41d4-a716-446655440007'
ORDER BY e.date_debut;

-- Vérifier aussi le contenu global de event_sectors
SELECT 
  COUNT(*) as total_liaisons,
  COUNT(DISTINCT sector_id) as secteurs_distincts,
  COUNT(DISTINCT event_id) as events_distincts
FROM event_sectors;

-- Et voir quelques exemples de liaisons
SELECT 
  es.sector_id,
  s.name as secteur_nom,
  es.event_id,
  e.nom_event
FROM event_sectors es
LEFT JOIN sectors s ON s.id = es.sector_id
LEFT JOIN events e ON e.id = es.event_id
LIMIT 10;
