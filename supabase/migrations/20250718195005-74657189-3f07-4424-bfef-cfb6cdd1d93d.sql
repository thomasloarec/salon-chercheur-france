
-- Migration: Update events table to use correct column names matching events_import
-- This will rename all columns to match the Airtable/events_import naming convention

-- Rename columns to match events_import structure
ALTER TABLE public.events RENAME COLUMN name TO nom_event;
ALTER TABLE public.events RENAME COLUMN event_type TO type_event;
ALTER TABLE public.events RENAME COLUMN start_date TO date_debut;
ALTER TABLE public.events RENAME COLUMN end_date TO date_fin;
ALTER TABLE public.events RENAME COLUMN sector TO secteur;
ALTER TABLE public.events RENAME COLUMN image_url TO url_image;
ALTER TABLE public.events RENAME COLUMN website_url TO url_site_officiel;
ALTER TABLE public.events RENAME COLUMN description TO description_event;
ALTER TABLE public.events RENAME COLUMN estimated_visitors TO affluence;
ALTER TABLE public.events RENAME COLUMN entry_fee TO tarif;
ALTER TABLE public.events RENAME COLUMN address TO rue;
ALTER TABLE public.events RENAME COLUMN postal_code TO code_postal;
ALTER TABLE public.events RENAME COLUMN city TO ville;
ALTER TABLE public.events RENAME COLUMN venue_name TO nom_lieu;

-- Drop unused columns that don't exist in events_import
ALTER TABLE public.events DROP COLUMN IF EXISTS location;
ALTER TABLE public.events DROP COLUMN IF EXISTS event_url;
ALTER TABLE public.events DROP COLUMN IF EXISTS organizer_name;
ALTER TABLE public.events DROP COLUMN IF EXISTS organizer_contact;

-- Update the search_events function to use new column names
DROP FUNCTION IF EXISTS public.search_events;

CREATE OR REPLACE FUNCTION public.search_events(
  location_type text DEFAULT 'text'::text, 
  location_value text DEFAULT ''::text, 
  sector_ids uuid[] DEFAULT '{}'::uuid[], 
  event_types text[] DEFAULT '{}'::text[], 
  months integer[] DEFAULT '{}'::integer[], 
  page_num integer DEFAULT 1, 
  page_size integer DEFAULT 20
)
RETURNS TABLE(
  id uuid, 
  nom_event text, 
  description_event text, 
  date_debut date, 
  date_fin date, 
  secteur text, 
  ville text, 
  region text, 
  country text, 
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
)
LANGUAGE plpgsql
AS $function$
DECLARE
  base_query text;
  where_conditions text[] DEFAULT '{}';
  total_events bigint;
BEGIN
  -- Conditions de base
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
  
  -- Retourner les résultats paginés avec le total
  RETURN QUERY EXECUTE format('
    SELECT e.id, e.nom_event, e.description_event, e.date_debut, e.date_fin, e.secteur, e.ville, e.region, e.country,
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
$function$;

-- Update the slug generation trigger to use nom_event
CREATE OR REPLACE FUNCTION public.auto_generate_event_slug()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
    new_slug text;
    event_year integer;
    counter integer := 0;
BEGIN
    -- Only generate slug if it's not provided
    IF NEW.slug IS NULL THEN
        -- Extract year from date_debut
        event_year := EXTRACT(YEAR FROM NEW.date_debut);
        
        -- Generate slug using nom_event (corrected column name)
        new_slug := generate_event_slug(NEW.nom_event, NEW.ville, event_year);
        
        -- Handle potential duplicates by appending a counter
        WHILE EXISTS (SELECT 1 FROM events WHERE slug = new_slug AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)) LOOP
            counter := counter + 1;
            new_slug := generate_event_slug(NEW.nom_event, NEW.ville, event_year) || '-' || counter;
        END LOOP;
        
        NEW.slug := new_slug;
    END IF;
    
    RETURN NEW;
END;
$function$;

CREATE TRIGGER auto_generate_event_slug_trigger
    BEFORE INSERT OR UPDATE ON events
    FOR EACH ROW
    EXECUTE FUNCTION auto_generate_event_slug();
