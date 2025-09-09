-- Corriger la fonction related_events pour éliminer l'ambiguïté des colonnes

DROP FUNCTION IF EXISTS public.related_events(text, int);

CREATE OR REPLACE FUNCTION public.related_events(
  p_event_id text,
  p_limit integer DEFAULT 8
)
RETURNS TABLE(
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
  shared_sectors_count integer
)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  WITH current_event AS (
    SELECT secteur
    FROM events
    WHERE id_event = p_event_id
  ),
  current_sectors AS (
    SELECT DISTINCT jsonb_array_elements_text(ce.secteur) as sector_name
    FROM current_event ce
    WHERE ce.secteur IS NOT NULL AND ce.secteur != '[]'::jsonb
  )
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
    ARRAY[]::uuid[] AS sectors, -- Placeholder pour compatibilité
    (
      SELECT COUNT(DISTINCT cs.sector_name)::integer
      FROM jsonb_array_elements_text(e.secteur) as event_sector
      JOIN current_sectors cs ON cs.sector_name = event_sector
      WHERE e.secteur IS NOT NULL AND e.secteur != '[]'::jsonb
    ) AS shared_sectors_count
  FROM events e, current_sectors cs
  WHERE e.visible = true
    AND COALESCE(e.date_debut, '0001-01-01'::date) >= CURRENT_DATE
    AND e.id_event <> p_event_id
    AND e.secteur IS NOT NULL 
    AND e.secteur != '[]'::jsonb
    AND EXISTS (
      SELECT 1
      FROM jsonb_array_elements_text(e.secteur) as event_sector
      WHERE event_sector = cs.sector_name
    )
  GROUP BY e.id, e.id_event, e.slug, e.nom_event, e.date_debut, e.date_fin, 
           e.url_image, e.nom_lieu, e.ville, e.secteur
  HAVING COUNT(DISTINCT cs.sector_name) > 0
  ORDER BY shared_sectors_count DESC, e.date_debut ASC
  LIMIT p_limit;
$$;