-- Finaliser la sécurisation des fonctions restantes

-- Fonction get_location_suggestions 
CREATE OR REPLACE FUNCTION public.get_location_suggestions(q text)
RETURNS TABLE(rank integer, type text, label text, value text)
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH input AS (
    SELECT LOWER(unaccent(
      regexp_replace(q, '[\s\u00A0\-\–\—]', '', 'g')
    )) AS q_norm
  ),
  ranked AS (
    SELECT 1 AS rank, 'city' AS type,
           c.nom AS label, c.nom AS value
    FROM   communes c, input i
    WHERE  regexp_replace(LOWER(unaccent(c.nom)), '[\s\u00A0\-\–\—]', '', 'g') 
           ILIKE '%' || i.q_norm || '%'

    UNION
    SELECT 2, 'department',
           d.nom, d.code
    FROM   departements d, input i
    WHERE  regexp_replace(LOWER(unaccent(d.nom)), '[\s\u00A0\-\–\—]', '', 'g')
           ILIKE '%' || i.q_norm || '%'

    UNION
    SELECT 3, 'region',
           r.nom, r.code
    FROM   regions r, input i
    WHERE  regexp_replace(LOWER(unaccent(r.nom)), '[\s\u00A0\-\–\—]', '', 'g')
           ILIKE '%' || i.q_norm || '%'
  )
  SELECT DISTINCT ON (label) ranked.*
  FROM   ranked
  ORDER  BY label, rank;
END;
$function$;

-- Fonction search_events
CREATE OR REPLACE FUNCTION public.search_events(
  sector_ids uuid[] DEFAULT '{}'::uuid[], 
  event_types text[] DEFAULT '{}'::text[], 
  months integer[] DEFAULT '{}'::integer[], 
  region_codes text[] DEFAULT '{}'::text[], 
  page_num integer DEFAULT 1, 
  page_size integer DEFAULT 20
)
RETURNS TABLE(id uuid, id_event text, nom_event text, date_debut date, date_fin date, ville text, secteur jsonb, url_image text, slug text, rue text, code_postal text, nom_lieu text, url_site_officiel text, type_event text, is_b2b boolean, visible boolean, total_count bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  wheres    text[] := ARRAY[
                'e.visible = true',
                'e.date_debut >= CURRENT_DATE'
              ];
  where_sql text;
  cnt       bigint;
BEGIN
  IF array_length(sector_ids,1) > 0 THEN
    wheres := wheres || ARRAY['e.id_event IN (SELECT event_id FROM event_sectors WHERE sector_id = ANY($1))'];
  END IF;

  IF array_length(event_types,1) > 0 THEN
    wheres := wheres || ARRAY['e.type_event = ANY($2)'];
  END IF;

  IF array_length(months,1) > 0 THEN
    wheres := wheres || ARRAY['EXTRACT(MONTH FROM e.date_debut)::int = ANY($3)'];
  END IF;

  IF array_length(region_codes,1) > 0 THEN
    wheres := wheres || ARRAY['EXISTS (
                           SELECT 1 FROM departements d
                           WHERE LEFT(e.code_postal, 2) = d.code
                             AND d.region_code = ANY($4)
                         )'];
  END IF;

  where_sql := array_to_string(wheres,' AND ');

  EXECUTE
    format('SELECT COUNT(DISTINCT e.id_event) FROM events e WHERE %s', where_sql)
    USING sector_ids, event_types, months, region_codes
    INTO cnt;

  RETURN QUERY EXECUTE
    format($q$
      SELECT DISTINCT
        e.id, e.id_event, e.nom_event, e.date_debut, e.date_fin, e.ville, e.secteur,
        e.url_image, e.slug, e.rue, e.code_postal, e.nom_lieu,
        e.url_site_officiel, e.type_event, e.is_b2b, e.visible,
        %L::bigint AS total_count
      FROM events e
      WHERE %s
      ORDER BY e.date_debut ASC
      LIMIT %s OFFSET %s
    $q$, cnt, where_sql, page_size, (page_num-1)*page_size)
    USING sector_ids, event_types, months, region_codes;
END;
$function$;

-- Fonction generate_event_slug
CREATE OR REPLACE FUNCTION public.generate_event_slug(event_name text, event_city text, event_year integer)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    clean_name text;
    clean_city text;
    slug text;
    counter integer := 0;
    final_slug text;
BEGIN
    clean_name := lower(event_name);
    clean_name := unaccent(clean_name);
    clean_name := regexp_replace(clean_name, '''', '', 'g');
    clean_name := regexp_replace(clean_name, '[^a-z0-9 -]', '', 'g');
    clean_name := regexp_replace(clean_name, ' +', '-', 'g');
    clean_name := regexp_replace(clean_name, '-+', '-', 'g');
    clean_name := trim(both '-' from clean_name);
    
    clean_city := lower(event_city);
    clean_city := unaccent(clean_city);
    clean_city := regexp_replace(clean_city, '''', '', 'g');
    clean_city := regexp_replace(clean_city, '[^a-z0-9]', '', 'g');
    
    slug := clean_name || '-' || event_year || '-' || clean_city;
    final_slug := slug;
    
    WHILE EXISTS (SELECT 1 FROM public.events WHERE slug = final_slug) LOOP
        counter := counter + 1;
        final_slug := slug || '-' || counter;
    END LOOP;
    
    RETURN final_slug;
END;
$function$;

-- Fonction update_existing_events_slugs
CREATE OR REPLACE FUNCTION public.update_existing_events_slugs()
RETURNS void
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
    event_record record;
    new_slug text;
    event_year integer;
    counter integer := 0;
BEGIN
    FOR event_record IN SELECT id, nom_event as name, ville as city, date_debut as start_date FROM events WHERE slug IS NULL LOOP
        event_year := EXTRACT(YEAR FROM event_record.start_date);
        
        new_slug := generate_event_slug(event_record.name, event_record.city, event_year);
        
        WHILE EXISTS (SELECT 1 FROM events WHERE slug = new_slug) LOOP
            counter := counter + 1;
            new_slug := generate_event_slug(event_record.name, event_record.city, event_year) || '-' || counter;
        END LOOP;
        
        UPDATE events SET slug = new_slug WHERE id = event_record.id;
        
        counter := 0;
    END LOOP;
END;
$function$;

-- Fonction auto_generate_event_slug (trigger function)
CREATE OR REPLACE FUNCTION public.auto_generate_event_slug()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
     NEW.slug := regexp_replace(lower(NEW.nom_event), '[^a-z0-9]+', '-', 'g');
  END IF;
  RETURN NEW;
END;
$function$;

-- Fonction sync_event_sectors (trigger function)  
CREATE OR REPLACE FUNCTION public.sync_event_sectors()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_sector record;
BEGIN
  DELETE FROM public.event_sectors WHERE event_id = NEW.id_event;

  FOR v_sector IN
    SELECT s.id, s.name
    FROM public.sectors s
    WHERE NEW.secteur IS NOT NULL 
      AND NEW.secteur != '[]'::jsonb
      AND (
        jsonb_path_exists(NEW.secteur, '$[*][*] ? (@ == $sector)', jsonb_build_object('sector', s.name))
        OR
        jsonb_path_exists(NEW.secteur, '$[*] ? (@ == $sector)', jsonb_build_object('sector', s.name))
      )
  LOOP
    INSERT INTO public.event_sectors(event_id, sector_id)
    VALUES (NEW.id_event, v_sector.id)
    ON CONFLICT DO NOTHING;
  END LOOP;

  RETURN NEW;
END;
$function$;

-- Fonction update_updated_at_column (trigger function)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$function$;

-- PHASE 4: Activer RLS sur les tables backup restantes
ALTER TABLE public.exposants_backup_20250101 ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin only backup access" ON public.exposants_backup_20250101 FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

ALTER TABLE public.participation_backup_20250101 ENABLE ROW LEVEL SECURITY;  
CREATE POLICY "Admin only backup access" ON public.participation_backup_20250101 FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());