-- Correction des fonctions avec search_path sécurisé (liées à la migration des slugs)
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
    -- Clean the event name
    clean_name := lower(event_name);
    clean_name := unaccent(clean_name);
    clean_name := regexp_replace(clean_name, '''', '', 'g'); -- Remove apostrophes
    clean_name := regexp_replace(clean_name, '[^a-z0-9 -]', '', 'g'); -- Remove special chars
    clean_name := regexp_replace(clean_name, ' +', '-', 'g'); -- Replace spaces with hyphens
    clean_name := regexp_replace(clean_name, '-+', '-', 'g'); -- Remove duplicate hyphens
    clean_name := trim(both '-' from clean_name); -- Remove leading/trailing hyphens
    
    -- Clean the city name
    clean_city := lower(event_city);
    clean_city := unaccent(clean_city);
    clean_city := regexp_replace(clean_city, '''', '', 'g'); -- Remove apostrophes
    clean_city := regexp_replace(clean_city, '[^a-z0-9]', '', 'g'); -- Remove all non-alphanumeric
    
    -- Generate the slug
    slug := clean_name || '-' || event_year || '-' || clean_city;
    final_slug := slug;
    
    -- Handle duplicates by appending counter
    WHILE EXISTS (SELECT 1 FROM public.events WHERE slug = final_slug) LOOP
        counter := counter + 1;
        final_slug := slug || '-' || counter;
    END LOOP;
    
    RETURN final_slug;
END;
$function$;

CREATE OR REPLACE FUNCTION public.auto_generate_event_slug()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  new_slug    text;
  event_year  integer;
  counter     integer := 0;
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' OR 
     NEW.slug LIKE 'pending-%' OR NEW.slug LIKE 'event-%' OR
     (TG_OP = 'UPDATE' AND (OLD.nom_event != NEW.nom_event OR OLD.ville != NEW.ville OR OLD.date_debut != NEW.date_debut)) THEN
    
    -- Extract year from date_debut
    event_year := EXTRACT(YEAR FROM NEW.date_debut);

    -- Generate slug using the improved function
    new_slug := public.generate_event_slug(NEW.nom_event, COALESCE(NEW.ville, 'inconnu'), event_year);

    -- Ensure uniqueness for this specific record
    WHILE EXISTS (
      SELECT 1
      FROM public.events
      WHERE slug = new_slug
        AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    ) LOOP
      counter := counter + 1;
      new_slug := public.generate_event_slug(NEW.nom_event, COALESCE(NEW.ville, 'inconnu'), event_year) || '-' || counter;
    END LOOP;

    NEW.slug := new_slug;
  END IF;

  RETURN NEW;
END;
$$;