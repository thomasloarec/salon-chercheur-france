-- Corriger les dernières fonctions système avec search_path 
-- Les fonctions trigram et unaccent sont des extensions systèmes, mais on peut encore les sécuriser

-- Les fonctions fill_city_from_address et fill_city_and_postal_from_address sont nos fonctions custom
CREATE OR REPLACE FUNCTION public.fill_city_from_address()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  extracted TEXT;
BEGIN
  SELECT trim(
           unaccent(
             regexp_replace(NEW.address, '.*\d{5}[ ,\-]+', '')
           )
         )
  INTO extracted;

  IF extracted <> '' THEN
    NEW.city := initcap(extracted);
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fill_city_and_postal_from_address()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.code_postal IS NULL OR NEW.code_postal = '' THEN
    NEW.code_postal := substring(NEW.rue FROM '(\d{5})');
  END IF;

  IF NEW.ville IS NULL OR NEW.ville = '' THEN
    NEW.ville := initcap(
      trim(
        unaccent(
          regexp_replace(NEW.rue, '.*\d{5}[ ,\-]+', '')
        )
      )
    );
  END IF;

  RETURN NEW;
END;
$function$;

-- Fonction ensure_commune_region_consistency
CREATE OR REPLACE FUNCTION public.ensure_commune_region_consistency()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
    SELECT region_code INTO NEW.region_code
    FROM public.departements
    WHERE code = NEW.dep_code;
    
    IF NEW.region_code IS NULL THEN
        RAISE EXCEPTION 'Département % introuvable pour la commune %', NEW.dep_code, NEW.nom;
    END IF;
    
    RETURN NEW;
END;
$function$;

-- Fonction search_events_test 
CREATE OR REPLACE FUNCTION public.search_events_test(
  sector_ids uuid[] DEFAULT '{}'::uuid[], 
  event_types text[] DEFAULT '{}'::text[], 
  months integer[] DEFAULT '{}'::integer[], 
  region_codes text[] DEFAULT '{}'::text[], 
  page_num integer DEFAULT 1, 
  page_size integer DEFAULT 20
)
RETURNS SETOF text
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  wheres text[] := ARRAY['true'];
BEGIN
  IF array_length(event_types,1) > 0 THEN
    wheres := wheres || ARRAY['true'];
  END IF;
  IF array_length(months,1) > 0 THEN
    wheres := wheres || ARRAY['true'];
  END IF;
  RETURN NEXT 'OK';
END;
$function$;

-- prevent_insert_on_publish est une fonction trigger
CREATE OR REPLACE FUNCTION public.prevent_insert_on_publish()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    RAISE EXCEPTION 'Insertion interdite : use UPDATE to publish existing events';
  END IF;
  RETURN NEW;
END;
$function$;

-- Il pourrait y avoir une vue SECURITY DEFINER restante, cherchons les vues système et recréons-les sans SECURITY DEFINER
-- Recréons la vue events_geo sans SECURITY DEFINER pour être sûr
DROP VIEW IF EXISTS public.events_geo CASCADE;

CREATE VIEW public.events_geo AS
SELECT 
  e.id,
  LEFT(e.code_postal, 2) as dep_code,
  d.region_code,
  e.code_postal
FROM public.events e
LEFT JOIN public.departements d ON LEFT(e.code_postal, 2) = d.code;