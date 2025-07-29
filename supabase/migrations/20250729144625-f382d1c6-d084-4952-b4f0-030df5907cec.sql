-- Peupler la table event_sectors avec les données existantes
INSERT INTO event_sectors (event_id, sector_id)
SELECT DISTINCT 
  e.id as event_id,
  s.id as sector_id
FROM events e
CROSS JOIN sectors s
WHERE e.secteur @> to_jsonb(s.name)
  AND NOT EXISTS (
    SELECT 1 FROM event_sectors es 
    WHERE es.event_id = e.id AND es.sector_id = s.id
  );

-- Peupler la table events_geo avec les codes régionaux basés sur le code postal
-- En utilisant les communes et départements pour mapper les régions
INSERT INTO events_geo (id, code_postal, dep_code, region_code)
SELECT DISTINCT
  e.id,
  e.code_postal,
  LEFT(e.code_postal, 2) as dep_code,
  d.region_code
FROM events e
JOIN departements d ON LEFT(e.code_postal, 2) = d.code
WHERE e.code_postal IS NOT NULL 
  AND e.code_postal ~ '^\d{5}$'  -- Vérifie que c'est un code postal valide
  AND NOT EXISTS (
    SELECT 1 FROM events_geo eg 
    WHERE eg.id = e.id
  );