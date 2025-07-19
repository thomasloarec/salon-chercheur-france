
-- Fix the search_events RPC function to use correct column names
DROP FUNCTION IF EXISTS public.search_events(text, text, uuid[], text[], integer[], integer, integer);

CREATE OR REPLACE FUNCTION public.search_events(
  location_type text DEFAULT 'text',
  location_value text DEFAULT '',
  sector_ids uuid[] DEFAULT '{}',
  event_types text[] DEFAULT '{}',
  months integer[] DEFAULT '{}',
  page_num integer DEFAULT 1,
  page_size integer DEFAULT 20
) RETURNS TABLE (
  id uuid,
  nom_event text,
  description_event text,
  date_debut date,
  date_fin date,
  secteur text,
  ville text,
  region text,
  pays text,
  nom_lieu text,
  url_image text,
  tags text[],
  affluence integer,
  estimated_exhibitors integer,
  is_b2b boolean,
  type_event text,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  last_scraped_at timestamp with time zone,
  scraped_from text,
  rue text,
  visible boolean,
  slug text,
  total_count bigint,
  code_postal text,
  url_site_officiel text,
  tarif text
) LANGUAGE plpgsql AS $$
DECLARE
  base_query text;
  where_conditions text[] DEFAULT '{}';
  total_events bigint;
BEGIN
  -- Conditions de base avec les nouveaux noms de colonnes
  where_conditions := array_append(where_conditions, 'e.visible = true');
  where_conditions := array_append(where_conditions, 'e.date_debut >= CURRENT_DATE');
  
  -- Filtres de localisation avec events_geo
  IF location_type = 'city' AND location_value != '' THEN
    where_conditions := array_append(where_conditions, format('e.ville ILIKE %L', '%' || location_value || '%'));
  ELSIF location_type = 'region' AND location_value != '' THEN
    where_conditions := array_append(where_conditions, format('e.id IN (SELECT id FROM events_geo WHERE region_code = %L)', location_value));
  ELSIF location_type = 'department' AND location_value != '' THEN
    where_conditions := array_append(where_conditions, format('e.id IN (SELECT id FROM events_geo WHERE dep_code = %L)', location_value));
  ELSIF location_type = 'text' AND location_value != '' THEN
    where_conditions := array_append(where_conditions, format('(e.ville ILIKE %L OR e.region ILIKE %L)', '%' || location_value || '%', '%' || location_value || '%'));
  END IF;
  
  -- Filtres secteurs
  IF array_length(sector_ids, 1) > 0 THEN
    where_conditions := array_append(where_conditions, format('e.id IN (SELECT event_id FROM event_sectors WHERE sector_id = ANY(%L))', sector_ids));
  END IF;
  
  -- Filtres types d'événements
  IF array_length(event_types, 1) > 0 THEN
    where_conditions := array_append(where_conditions, format('e.type_event = ANY(%L)', event_types));
  END IF;
  
  -- Filtres mois
  IF array_length(months, 1) > 0 THEN
    where_conditions := array_append(where_conditions, format('EXTRACT(MONTH FROM e.date_debut) = ANY(%L)', months));
  END IF;
  
  -- Construire la requête avec alias dès le départ
  base_query := 'FROM events e WHERE ' || array_to_string(where_conditions, ' AND ');
  
  -- Compter le total
  EXECUTE 'SELECT COUNT(*) ' || base_query INTO total_events;
  
  -- Retourner les résultats paginés avec le total (utilise les nouveaux noms de colonnes)
  RETURN QUERY EXECUTE format('
    SELECT e.id, e.nom_event, e.description_event, e.date_debut, e.date_fin, e.secteur, e.ville, e.region, e.pays,
           e.nom_lieu, e.url_image, e.tags, e.affluence, e.estimated_exhibitors, e.is_b2b, e.type_event, e.created_at, e.updated_at,
           e.last_scraped_at, e.scraped_from, e.rue, e.visible, e.slug, %L::bigint as total_count, 
           e.code_postal, e.url_site_officiel, e.tarif
    %s 
    ORDER BY e.date_debut ASC 
    LIMIT %L OFFSET %L',
    total_events,
    base_query,
    page_size,
    (page_num - 1) * page_size
  );
END;
$$;
