
-- Créer la vue events_geo pour les filtres géographiques robustes
CREATE OR REPLACE VIEW public.events_geo AS
SELECT 
  e.id,
  e.city,
  e.region,
  c.dep_code,
  c.region_code
FROM public.events e
LEFT JOIN public.communes c ON LOWER(UNACCENT(e.city)) = LOWER(UNACCENT(c.nom));

-- Créer la fonction get_location_suggestions avec gestion robuste des espaces/tirets
CREATE OR REPLACE FUNCTION public.get_location_suggestions(q text)
RETURNS TABLE (
  rank integer,
  type text,
  label text,
  value text
) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  WITH input AS (
    SELECT LOWER(unaccent(regexp_replace(q, '[\s\-]', '', 'g'))) AS q_norm
  )
  SELECT DISTINCT ON (label) ranked.*
  FROM (
    SELECT 1 AS rank, 'city' AS type, c.nom AS label, c.nom AS value
    FROM   communes c, input i
    WHERE  LOWER(unaccent(regexp_replace(c.nom, '[\s\-]', '', 'g'))) LIKE i.q_norm || '%'

    UNION
    SELECT 2, 'department', d.nom, d.code
    FROM   departements d, input i
    WHERE  LOWER(unaccent(regexp_replace(d.nom, '[\s\-]', '', 'g'))) LIKE i.q_norm || '%'

    UNION
    SELECT 3, 'region', r.nom, r.code
    FROM   regions r, input i
    WHERE  LOWER(unaccent(regexp_replace(r.nom, '[\s\-]', '', 'g'))) LIKE i.q_norm || '%'
  ) AS ranked
  ORDER BY label, rank;
END;
$$;

-- Mettre à jour la fonction search_events avec les nouveaux filtres
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
  name text,
  description text,
  start_date date,
  end_date date,
  sector text,
  location text,
  city text,
  region text,
  country text,
  venue_name text,
  event_url text,
  image_url text,
  tags text[],
  organizer_name text,
  organizer_contact text,
  entry_fee text,
  estimated_visitors integer,
  estimated_exhibitors integer,
  is_b2b boolean,
  event_type text,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  last_scraped_at timestamp with time zone,
  scraped_from text,
  address text,
  visible boolean,
  slug text,
  total_count bigint
) LANGUAGE plpgsql AS $$
DECLARE
  base_query text;
  where_conditions text[] DEFAULT '{}';
  total_events bigint;
BEGIN
  -- Conditions de base
  where_conditions := array_append(where_conditions, 'e.visible = true');
  where_conditions := array_append(where_conditions, 'e.start_date >= CURRENT_DATE');
  
  -- Filtres de localisation avec events_geo
  IF location_type = 'city' AND location_value != '' THEN
    where_conditions := array_append(where_conditions, format('e.city ILIKE %L', '%' || location_value || '%'));
  ELSIF location_type = 'region' AND location_value != '' THEN
    where_conditions := array_append(where_conditions, format('e.id IN (SELECT id FROM events_geo WHERE region_code = %L)', location_value));
  ELSIF location_type = 'department' AND location_value != '' THEN
    where_conditions := array_append(where_conditions, format('e.id IN (SELECT id FROM events_geo WHERE dep_code = %L)', location_value));
  ELSIF location_type = 'text' AND location_value != '' THEN
    where_conditions := array_append(where_conditions, format('(e.city ILIKE %L OR e.region ILIKE %L OR e.location ILIKE %L)', '%' || location_value || '%', '%' || location_value || '%', '%' || location_value || '%'));
  END IF;
  
  -- Filtres secteurs
  IF array_length(sector_ids, 1) > 0 THEN
    where_conditions := array_append(where_conditions, format('e.id IN (SELECT event_id FROM event_sectors WHERE sector_id = ANY(%L))', sector_ids));
  END IF;
  
  -- Filtres types d'événements
  IF array_length(event_types, 1) > 0 THEN
    where_conditions := array_append(where_conditions, format('e.event_type = ANY(%L)', event_types));
  END IF;
  
  -- Filtres mois
  IF array_length(months, 1) > 0 THEN
    where_conditions := array_append(where_conditions, format('EXTRACT(MONTH FROM e.start_date) = ANY(%L)', months));
  END IF;
  
  -- Construire la requête avec alias dès le départ
  base_query := 'FROM events e WHERE ' || array_to_string(where_conditions, ' AND ');
  
  -- Compter le total
  EXECUTE 'SELECT COUNT(*) ' || base_query INTO total_events;
  
  -- Retourner les résultats paginés avec le total
  RETURN QUERY EXECUTE format('
    SELECT e.id, e.name, e.description, e.start_date, e.end_date, e.sector, e.location, e.city, e.region, e.country,
           e.venue_name, e.event_url, e.image_url, e.tags, e.organizer_name, e.organizer_contact, e.entry_fee,
           e.estimated_visitors, e.estimated_exhibitors, e.is_b2b, e.event_type, e.created_at, e.updated_at,
           e.last_scraped_at, e.scraped_from, e.address, e.visible, e.slug, %L::bigint as total_count
    %s 
    ORDER BY e.start_date ASC 
    LIMIT %L OFFSET %L',
    total_events,
    base_query,
    page_size,
    (page_num - 1) * page_size
  );
END;
$$;
