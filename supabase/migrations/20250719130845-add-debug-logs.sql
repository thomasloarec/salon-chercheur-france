

-- Add debug logging to search_events RPC function
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
  where_conditions text[] DEFAULT '{}';
  query_text text;
  total_events bigint;
  offset_value integer;
BEGIN
  -- Log tous les paramètres d'entrée immédiatement
  RAISE NOTICE 'search_events paramètres – location_type=%, location_value=%, sector_ids=%, event_types=%, months=%',
    location_type, location_value, sector_ids, event_types, months;
  
  -- Log détaillé pour le filtre secteur
  RAISE NOTICE '▶ search_events called with sector_ids = %', sector_ids;
  RAISE NOTICE '▶ matching event_sectors count = %', (
    SELECT COUNT(*) 
    FROM event_sectors 
    WHERE sector_id = ANY(sector_ids)
  );
  
  -- Calculate offset
  offset_value := (page_num - 1) * page_size;
  
  -- Base conditions
  where_conditions := array_append(where_conditions, 'e.visible = true');
  where_conditions := array_append(where_conditions, 'e.date_debut >= CURRENT_DATE');
  
  -- Location filters
  IF location_type = 'city' AND location_value != '' THEN
    where_conditions := array_append(where_conditions, format('e.ville ILIKE %L', '%' || location_value || '%'));
  ELSIF location_type = 'region' AND location_value != '' THEN
    where_conditions := array_append(where_conditions, format('e.id IN (SELECT id FROM events_geo WHERE region_code = %L)', location_value));
  ELSIF location_type = 'department' AND location_value != '' THEN
    where_conditions := array_append(where_conditions, format('e.id IN (SELECT id FROM events_geo WHERE dep_code = %L)', location_value));
  ELSIF location_type = 'text' AND location_value != '' THEN
    where_conditions := array_append(where_conditions, format('(e.ville ILIKE %L OR e.region ILIKE %L)', '%' || location_value || '%', '%' || location_value || '%'));
  END IF;
  
  -- Sector filter using event_sectors junction table
  IF array_length(sector_ids, 1) > 0 THEN
    where_conditions := array_append(where_conditions, 'e.id IN (SELECT event_id FROM event_sectors WHERE sector_id = ANY($3))');
    RAISE NOTICE 'RPC search_events: Filtering by sector_ids: %', sector_ids;
  END IF;
  
  -- Event types filter
  IF array_length(event_types, 1) > 0 THEN
    where_conditions := array_append(where_conditions, 'e.type_event = ANY($4)');
    RAISE NOTICE 'RPC search_events: Filtering by event_types: %', event_types;
  END IF;
  
  -- Months filter
  IF array_length(months, 1) > 0 THEN
    where_conditions := array_append(where_conditions, 'EXTRACT(MONTH FROM e.date_debut) = ANY($5)');
    RAISE NOTICE 'RPC search_events: Filtering by months: %', months;
  END IF;
  
  -- Build the complete query
  query_text := format('
    SELECT e.id, e.nom_event, e.description_event, e.date_debut, e.date_fin, e.secteur, e.ville, e.region, e.pays,
           e.nom_lieu, e.url_image, e.tags, e.affluence, e.estimated_exhibitors, e.is_b2b, e.type_event, 
           e.created_at, e.updated_at, e.last_scraped_at, e.scraped_from, e.rue, e.visible, e.slug,
           (SELECT COUNT(*) FROM events e2 WHERE %s)::bigint as total_count,
           e.code_postal, e.url_site_officiel, e.tarif
    FROM events e 
    WHERE %s
    ORDER BY e.date_debut ASC 
    LIMIT $1 OFFSET $2',
    array_to_string(where_conditions, ' AND '),
    array_to_string(where_conditions, ' AND ')
  );
  
  RAISE NOTICE 'RPC search_events: Executing query with params - page_size: %, offset: %, sector_ids: %, event_types: %, months: %', 
    page_size, offset_value, sector_ids, event_types, months;
  
  -- Execute with consistent parameter positions: $1=page_size, $2=offset, $3=sector_ids, $4=event_types, $5=months
  RETURN QUERY EXECUTE query_text USING page_size, offset_value, sector_ids, event_types, months;
  
  -- Log results count
  GET DIAGNOSTICS total_events = ROW_COUNT;
  RAISE NOTICE 'RPC search_events: Returned % events', total_events;
END;
$$;

