
-- Vérifier directement les liens pour le secteur "Santé & Médical"
SELECT 
  es.event_id,
  e.nom_event,
  e.ville,
  e.date_debut
FROM event_sectors es
JOIN events e ON e.id = es.event_id
WHERE es.sector_id = '550e8400-e29b-41d4-a716-446655440007'
  AND e.visible = true
  AND e.date_debut >= CURRENT_DATE
ORDER BY e.date_debut;

-- Compter les liens totaux pour ce secteur
SELECT COUNT(*) as total_links
FROM event_sectors 
WHERE sector_id = '550e8400-e29b-41d4-a716-446655440007';

-- Refactorer complètement la RPC avec INNER JOIN
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
BEGIN
  RAISE NOTICE 'search_events called with sector_ids: %', sector_ids;
  
  -- Si filtre secteurs, ajouter le INNER JOIN
  IF array_length(sector_ids, 1) > 0 THEN
    base_from := base_from || ' INNER JOIN event_sectors es ON es.event_id = e.id';
    where_clauses := array_append(where_clauses, 'es.sector_id = ANY($3)');
    RAISE NOTICE 'Added INNER JOIN event_sectors for sector_ids: %', sector_ids;
  END IF;
  
  -- Filtres de localisation
  IF location_type = 'city' AND location_value != '' THEN
    where_clauses := array_append(where_clauses, format('e.ville ILIKE %L', '%' || location_value || '%'));
  ELSIF location_type = 'region' AND location_value != '' THEN
    where_clauses := array_append(where_clauses, format('e.region ILIKE %L', '%' || location_value || '%'));
  ELSIF location_type = 'department' AND location_value != '' THEN
    where_clauses := array_append(where_clauses, format('e.code_postal LIKE %L', location_value || '%'));
  ELSIF location_type = 'text' AND location_value != '' THEN
    where_clauses := array_append(where_clauses, format('(e.ville ILIKE %L OR e.region ILIKE %L)', '%' || location_value || '%', '%' || location_value || '%'));
  END IF;
  
  -- Filtres types d'événements
  IF array_length(event_types, 1) > 0 THEN
    where_clauses := array_append(where_clauses, 'e.type_event = ANY($4)');
  END IF;
  
  -- Filtres mois
  IF array_length(months, 1) > 0 THEN
    where_clauses := array_append(where_clauses, 'EXTRACT(MONTH FROM e.date_debut) = ANY($5)');
  END IF;
  
  -- Compter d'abord le total
  count_sql := format('SELECT COUNT(DISTINCT e.id) FROM %s WHERE %s', 
    base_from, 
    array_to_string(where_clauses, ' AND ')
  );
  
  RAISE NOTICE 'COUNT SQL: %', count_sql;
  EXECUTE count_sql USING page_size, offset_value, sector_ids, event_types, months INTO total_events;
  RAISE NOTICE 'Total events found: %', total_events;
  
  -- Construire la requête principale
  query_sql := format('
    SELECT DISTINCT e.id, e.nom_event, e.description_event, e.date_debut, e.date_fin, e.secteur, 
           e.ville, e.region, e.pays, e.nom_lieu, e.url_image, e.tags, e.affluence, 
           e.estimated_exhibitors, e.is_b2b, e.type_event, e.created_at, e.updated_at, 
           e.last_scraped_at, e.scraped_from, e.rue, e.visible, e.slug,
           %L::bigint as total_count,
           e.code_postal, e.url_site_officiel, e.tarif
    FROM %s 
    WHERE %s
    ORDER BY e.date_debut ASC 
    LIMIT $1 OFFSET $2',
    total_events,
    base_from,
    array_to_string(where_clauses, ' AND ')
  );
  
  RAISE NOTICE 'MAIN SQL: %', query_sql;
  RAISE NOTICE 'Parameters: page_size=%s, offset=%s, sector_ids=%s, event_types=%s, months=%s', 
    page_size, offset_value, sector_ids, event_types, months;
  
  RETURN QUERY EXECUTE query_sql USING page_size, offset_value, sector_ids, event_types, months;
  
  GET DIAGNOSTICS total_events = ROW_COUNT;
  RAISE NOTICE 'Returned % rows', total_events;
END;
$$;
