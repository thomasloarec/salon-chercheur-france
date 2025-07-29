-- Peupler uniquement la table event_sectors avec les données existantes
INSERT INTO event_sectors (event_id, sector_id)
SELECT DISTINCT 
  e.id_event as event_id,
  s.id as sector_id
FROM events e
CROSS JOIN sectors s
WHERE e.secteur @> to_jsonb(s.name)
  AND e.visible = true;