
-- 1. Vérifier la présence de liens dans event_sectors pour ce secteur
SELECT COUNT(*)                          AS total_links,
       COUNT(DISTINCT event_id)          AS events_linked
  FROM event_sectors
 WHERE sector_id = '550e8400-e29b-41d4-a716-446655440007';

-- 2. Vérifier que les filtres visible/date_debut ne filtrent pas tout
-- D'abord sans les filtres de base
SELECT COUNT(*) as events_total_for_sector
  FROM events e
  JOIN event_sectors es ON es.event_id = e.id
 WHERE es.sector_id = '550e8400-e29b-41d4-a716-446655440007';

-- Puis avec les filtres visible = true et date_debut >= CURRENT_DATE
SELECT COUNT(*) as events_filtered_for_sector
  FROM events e
  JOIN event_sectors es ON es.event_id = e.id
 WHERE es.sector_id = '550e8400-e29b-41d4-a716-446655440007'
   AND e.visible = true
   AND e.date_debut >= CURRENT_DATE;

-- 3. Tester la RPC directement pour capturer tous les NOTICE
SELECT *
  FROM public.search_events(
    'text',                               -- location_type
    '',                                   -- location_value
    ARRAY['550e8400-e29b-41d4-a716-446655440007']::uuid[],
    '{}'::text[],                         -- event_types
    '{}'::int[],                          -- months
    1, 20);

-- 4. Améliorer la RPC pour logger les paramètres exacts avant l'EXECUTE
DROP FUNCTION IF EXISTS public.search_events;

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
  offset_value integer := (page_num - 1) * page_size;
  base_from text := 'events e';
  where_clauses text[] := ARRAY['e.visible = true', 'e.date_debut >= CURRENT_DATE'];
  query_sql text;
  count_sql text;
  total_events bigint;
  debug_event_ids uuid[];
BEGIN
  -- Log tous les paramètres d'entrée immédiatement
  RAISE NOTICE 'search_events paramètres – location_type=%, location_value=%, sector_ids=%, event_types=%, months=%',
    location_type, location_value, sector_ids, event_types, months;
  
  -- Log détaillé pour le filtre secteur
  RAISE NOTICE '▶ search_events called with sector_ids = %', sector_ids;
  
  -- NOUVEAU: Log précis du contenu de event_sectors pour ces secteurs
  SELECT array_agg(es.event_id) INTO debug_event_ids
  FROM event_sectors es
  WHERE es.sector_id = ANY(sector_ids);
  
  RAISE NOTICE 'event_sectors pour % → %', sector_ids, debug_event_ids;
  RAISE NOTICE '▶ matching event_sectors count = %', array_length(debug_event_ids, 1);
  
  -- Log des types de paramètres
  RAISE NOTICE 'param types: page_size % (%), offset % (%), sector_ids % (%)',
    page_size, pg_typeof(page_size),
    (page_num - 1) * page_size, pg_typeof((page_num - 1) * page_size),
    sector_ids, pg_typeof(sector_ids);
  
  -- Log du total d'événements visibles et futurs
  RAISE NOTICE '▶ TOTAL events visibles & futurs = %',
    (SELECT COUNT(*) FROM events e WHERE e.visible = true AND e.date_debut >= CURRENT_DATE);
  
  -- Log des événements matchant les secteurs
  RAISE NOTICE '▶ events matching sector_ids = %',
    (SELECT COUNT(*) FROM events e
      JOIN event_sectors es ON es.event_id = e.id
      WHERE es.sector_id = ANY(sector_ids)
        AND e.visible = true
        AND e.date_debut >= CURRENT_DATE);
  
  -- Calculate offset
  offset_value := (page_num - 1) * page_size;
  
  -- Build FROM clause with conditional JOIN for sectors
  IF array_length(sector_ids, 1) > 0 THEN
    base_from := 'FROM events e JOIN event_sectors es ON es.event_id = e.id AND es.sector_id = ANY($3)';
    RAISE NOTICE 'RPC search_events: Using JOIN for sector filtering with sector_ids: %', sector_ids;
  ELSE
    base_from := 'FROM events e';
  END IF;
  
  -- Base conditions
  where_clauses := array_append(where_clauses, 'e.visible = true');
  where_clauses := array_append(where_clauses, 'e.date_debut >= CURRENT_DATE');
  
  -- Location filters
  IF location_type = 'city' AND location_value != '' THEN
    where_clauses := array_append(where_clauses, format('e.ville ILIKE %L', '%' || location_value || '%'));
  ELSIF location_type = 'region' AND location_value != '' THEN
    where_clauses := array_append(where_clauses, format('e.id IN (SELECT id FROM events_geo WHERE region_code = %L)', location_value));
  ELSIF location_type = 'department' AND location_value != '' THEN
    where_clauses := array_append(where_clauses, format('e.id IN (SELECT id FROM events_geo WHERE dep_code = %L)', location_value));
  ELSIF location_type = 'text' AND location_value != '' THEN
    where_clauses := array_append(where_clauses, format('(e.ville ILIKE %L OR e.region ILIKE %L)', '%' || location_value || '%', '%' || location_value || '%'));
  END IF;
  
  -- Event types filter
  IF array_length(event_types, 1) > 0 THEN
    where_clauses := array_append(where_clauses, 'e.type_event = ANY($4)');
    RAISE NOTICE 'RPC search_events: Filtering by event_types: %', event_types;
  END IF;
  
  -- Months filter
  IF array_length(months, 1) > 0 THEN
    where_clauses := array_append(where_clauses, 'EXTRACT(MONTH FROM e.date_debut) = ANY($5)');
    RAISE NOTICE 'RPC search_events: Filtering by months: %', months;
  END IF;
  
  -- First execute count query separately to avoid column ambiguity
  EXECUTE format('SELECT COUNT(*) %s WHERE %s', base_from, array_to_string(where_clauses, ' AND '))
    USING page_size, offset_value, sector_ids, event_types, months
    INTO total_events;
  
  RAISE NOTICE 'RPC search_events: Count query returned %', total_events;
  
  -- Build the main query without subselect
  query_sql := format('
    SELECT e.id, e.nom_event, e.description_event, e.date_debut, e.date_fin, e.secteur, e.ville, e.region, e.pays,
           e.nom_lieu, e.url_image, e.tags, e.affluence, e.estimated_exhibitors, e.is_b2b, e.type_event, 
           e.created_at, e.updated_at, e.last_scraped_at, e.scraped_from, e.rue, e.visible, e.slug,
           %L::bigint as total_count,
           e.code_postal, e.url_site_officiel, e.tarif
    %s 
    WHERE %s
    ORDER BY e.date_debut ASC 
    LIMIT $1 OFFSET $2',
    total_events,
    base_from,
    array_to_string(where_clauses, ' AND ')
  );
  
  RAISE NOTICE 'RPC search_events: Executing query with params - page_size: %, offset: %, sector_ids: %, event_types: %, months: %', 
    page_size, offset_value, sector_ids, event_types, months;
  
  -- Execute with consistent parameter positions: $1=page_size, $2=offset, $3=sector_ids, $4=event_types, $5=months
  RETURN QUERY EXECUTE query_sql USING page_size, offset_value, sector_ids, event_types, months;
  
  -- Log results count
  GET DIAGNOSTICS total_events = ROW_COUNT;
  RAISE NOTICE 'RPC search_events: Returned % events', total_events;
  RAISE NOTICE '▶ TOTAL après WHERE = %', total_events;
END;
$$;
