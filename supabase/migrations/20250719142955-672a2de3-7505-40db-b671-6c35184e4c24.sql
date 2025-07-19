
-- 1. Identifier la colonne libellé dans sectors
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name='sectors' AND table_schema='public';

-- 2. Vérifier le contenu actuel de events.secteur pour comprendre le format
SELECT secteur, pg_typeof(secteur) as type_secteur
FROM events 
LIMIT 5;

-- 3. Sécuriser event_sectors (pas de seconde PK)
ALTER TABLE event_sectors
  ADD CONSTRAINT IF NOT EXISTS event_sectors_event_id_sector_id_key
  UNIQUE (event_id, sector_id);

CREATE INDEX IF NOT EXISTS idx_event_sectors_eventid_sectorid
  ON event_sectors(event_id, sector_id);

-- 4. Back-fill des liaisons en utilisant 'name' comme colonne libellé
-- (En supposant que secteur est en format text avec des noms de secteurs)
INSERT INTO event_sectors (event_id, sector_id)
SELECT DISTINCT e.id, s.id
FROM   events e
JOIN   sectors s ON LOWER(TRIM(e.secteur)) = LOWER(TRIM(s.name))
LEFT   JOIN event_sectors es ON es.event_id = e.id AND es.sector_id = s.id
WHERE  es.event_id IS NULL
  AND  e.secteur IS NOT NULL 
  AND  e.secteur != '';

-- 5. Créer le trigger de synchro pour maintenir la cohérence
CREATE OR REPLACE FUNCTION sync_event_sectors() RETURNS TRIGGER AS $$
DECLARE
  v_sector_id uuid;
BEGIN
  -- Purger les anciennes liaisons
  DELETE FROM event_sectors WHERE event_id = NEW.id;

  -- Recréer les liaisons basées sur le nom du secteur
  IF NEW.secteur IS NOT NULL AND NEW.secteur != '' THEN
    FOR v_sector_id IN
      SELECT s.id 
      FROM sectors s 
      WHERE LOWER(TRIM(s.name)) = LOWER(TRIM(NEW.secteur))
    LOOP
      INSERT INTO event_sectors(event_id, sector_id)
      VALUES (NEW.id, v_sector_id) 
      ON CONFLICT (event_id, sector_id) DO NOTHING;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_event_sectors ON events;
CREATE TRIGGER trg_sync_event_sectors
AFTER INSERT OR UPDATE OF secteur ON events
FOR EACH ROW
EXECUTE FUNCTION sync_event_sectors();

-- 6. Vérifications finales
SELECT COUNT(*) as total_event_sectors FROM event_sectors;

SELECT s.name, COUNT(es.event_id) as nb_events
FROM sectors s
LEFT JOIN event_sectors es ON es.sector_id = s.id
GROUP BY s.id, s.name
ORDER BY s.name;

-- 7. Test spécifique pour le secteur "Santé & Médical"
SELECT s.name, COUNT(es.event_id) as nb_events_sante
FROM sectors s
LEFT JOIN event_sectors es ON es.sector_id = s.id
WHERE s.id = '550e8400-e29b-41d4-a716-446655440007'
GROUP BY s.id, s.name;
