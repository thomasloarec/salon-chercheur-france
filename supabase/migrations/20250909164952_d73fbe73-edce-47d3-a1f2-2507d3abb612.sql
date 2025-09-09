-- Corriger la fonction related_events pour utiliser le champ secteur (jsonb) directement
-- au lieu de la table event_sectors qui n'est pas synchronisée

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
      ARRAY[]::uuid[] AS sectors, -- Placeholder pour compatibilité
      (
        SELECT COUNT(DISTINCT sector_name)::integer
        FROM (
          SELECT jsonb_array_elements_text(e.secteur) as sector_name
          WHERE e.secteur IS NOT NULL AND e.secteur != '[]'::jsonb
        ) e_sectors
        JOIN current_sectors cs ON cs.sector_name = e_sectors.sector_name
      ) AS shared_sectors_count
    FROM events e
    WHERE e.visible = true
      -- Inclure aujourd'hui et les événements à venir (Europe/Paris)
      AND COALESCE(e.date_debut, '0001-01-01'::date) >= CURRENT_DATE
      AND e.id_event <> p_event_id
      AND e.secteur IS NOT NULL 
      AND e.secteur != '[]'::jsonb
      -- Vérifier qu'il y a au moins un secteur en commun
      AND EXISTS (
        SELECT 1
        FROM (
          SELECT jsonb_array_elements_text(e.secteur) as sector_name
        ) e_sectors
        JOIN current_sectors cs ON cs.sector_name = e_sectors.sector_name
      )
  )
  SELECT
    id, id_event, slug, nom_event, date_debut, date_fin, url_image, nom_lieu, ville, sectors, shared_sectors_count
  FROM candidates
  WHERE shared_sectors_count > 0
  ORDER BY shared_sectors_count DESC, date_debut ASC
  LIMIT p_limit;
$$;