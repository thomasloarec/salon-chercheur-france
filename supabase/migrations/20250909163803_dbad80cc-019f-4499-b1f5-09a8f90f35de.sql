-- Create function to find related events based on shared sectors
CREATE OR REPLACE FUNCTION public.related_events(
  p_event_id text,
  p_limit int DEFAULT 8
)
RETURNS TABLE (
  id uuid,
  id_event text,
  slug text,
  nom_event text,
  date_debut date,
  date_fin date,
  url_image text,
  nom_lieu text,
  ville text,
  sectors uuid[],
  shared_sectors_count int
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH current_sectors AS (
    SELECT es.sector_id
    FROM event_sectors es
    WHERE es.event_id = p_event_id
  ),
  candidates AS (
    SELECT
      e.id,
      e.id_event,
      e.slug,
      e.nom_event,
      e.date_debut,
      e.date_fin,
      e.url_image,
      e.nom_lieu,
      e.ville,
      ARRAY(
        SELECT es2.sector_id
        FROM event_sectors es2
        WHERE es2.event_id = e.id_event
      ) AS sectors,
      (
        SELECT COUNT(*)::int
        FROM event_sectors es3
        WHERE es3.event_id = e.id_event
          AND es3.sector_id IN (SELECT sector_id FROM current_sectors)
      ) AS shared_sectors_count
    FROM events e
    WHERE e.visible = true
      AND e.date_debut >= CURRENT_DATE
      AND e.id_event <> p_event_id
      AND EXISTS (
        SELECT 1
        FROM event_sectors es4
        WHERE es4.event_id = e.id_event
          AND es4.sector_id IN (SELECT sector_id FROM current_sectors)
      )
  )
  SELECT
    id, id_event, slug, nom_event, date_debut, date_fin, url_image, nom_lieu, ville, sectors, shared_sectors_count
  FROM candidates
  ORDER BY shared_sectors_count DESC, date_debut ASC
  LIMIT p_limit;
$$;