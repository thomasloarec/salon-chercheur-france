-- ============================================================================
-- CRITICAL SECURITY FIXES - Phase 2: Minor Security Improvements
-- ============================================================================

-- SECTION 1: Add SECURITY DEFINER to all trigger and RPC functions
-- ----------------------------------------------------------------

-- Update all trigger functions with SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_event_sectors()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_sector record;
BEGIN
  DELETE FROM public.event_sectors WHERE event_id = NEW.id_event;

  -- Handle secteur as JSONB array
  IF NEW.secteur IS NOT NULL THEN
    FOR v_sector IN
      SELECT s.id
      FROM public.sectors s
      WHERE EXISTS (
        SELECT 1 
        FROM jsonb_array_elements_text(NEW.secteur) AS sector_name
        WHERE s.name ILIKE '%' || sector_name || '%'
      )
    LOOP
      INSERT INTO public.event_sectors(event_id, sector_id)
      VALUES (NEW.id_event, v_sector.id)
      ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.auto_generate_event_slug()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  new_slug    text;
  event_year  integer;
  counter     integer := 0;
BEGIN
  IF NEW.slug IS NULL THEN
    -- Extract year from date_debut
    event_year := EXTRACT(YEAR FROM NEW.date_debut);

    -- Generate slug from nom_event and ville
    new_slug := generate_event_slug(NEW.nom_event, NEW.ville, event_year);

    -- Handle duplicates
    WHILE EXISTS (
      SELECT 1
      FROM public.events
      WHERE slug = new_slug
        AND id_event != NEW.id_event
    ) LOOP
      counter := counter + 1;
      new_slug := generate_event_slug(NEW.nom_event, NEW.ville, event_year)
                  || '-' || counter;
    END LOOP;

    NEW.slug := new_slug;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.fill_city_and_postal_from_address()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Extract code_postal from rue if missing
  IF NEW.code_postal IS NULL OR NEW.code_postal = '' THEN
    NEW.code_postal := substring(NEW.rue FROM '(\d{5})');
  END IF;

  -- Extract ville from rue if missing
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
$$;

CREATE OR REPLACE FUNCTION public.fill_city_from_address()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  extracted TEXT;
BEGIN
  -- Extract city from address after postal code
  SELECT trim(
           unaccent(
             regexp_replace(NEW.location, '.*\d{5}[ ,\-]+', '')
           )
         )
  INTO extracted;

  IF extracted <> '' THEN
    NEW.ville := initcap(extracted);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_commune_region_consistency()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    -- Get region code from department
    SELECT region_code INTO NEW.region_code
    FROM public.departements
    WHERE code = NEW.dep_code;
    
    -- Raise error if department not found
    IF NEW.region_code IS NULL THEN
        RAISE EXCEPTION 'Département % introuvable pour la commune %', NEW.dep_code, NEW.nom;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Update RPC functions with SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.get_location_suggestions(q text)
RETURNS TABLE(rank integer, type text, label text, value text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  WITH input AS (
    SELECT LOWER(unaccent(
      regexp_replace(q, '[\s\u00A0\-\–\—]', '', 'g')
    )) AS q_norm
  ),
  ranked AS (
    -- 1. City: absolute priority (rank 1)
    SELECT 1 AS rank, 'city' AS type,
           c.nom AS label, c.nom AS value
    FROM   communes c, input i
    WHERE  regexp_replace(LOWER(unaccent(c.nom)), '[\s\u00A0\-\–\—]', '', 'g') 
           ILIKE '%' || i.q_norm || '%'

    UNION
    -- 2. Department (rank 2)
    SELECT 2, 'department',
           d.nom, d.code
    FROM   departements d, input i
    WHERE  regexp_replace(LOWER(unaccent(d.nom)), '[\s\u00A0\-\–\—]', '', 'g')
           ILIKE '%' || i.q_norm || '%'

    UNION
    -- 3. Region (rank 3)
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
$$;

CREATE OR REPLACE FUNCTION public.search_events(
  sector_ids uuid[] DEFAULT '{}'::uuid[], 
  event_types text[] DEFAULT '{}'::text[], 
  months integer[] DEFAULT '{}'::integer[], 
  region_codes text[] DEFAULT '{}'::text[], 
  page_num integer DEFAULT 1, 
  page_size integer DEFAULT 20
)
RETURNS TABLE(
  id_event text, 
  nom_event text, 
  date_debut date, 
  date_fin date, 
  ville text, 
  secteur jsonb, 
  url_image text, 
  slug text, 
  rue text, 
  code_postal text, 
  nom_lieu text, 
  url_site_officiel text, 
  type_event text, 
  is_b2b boolean, 
  visible boolean, 
  total_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  wheres    text[] := ARRAY[
                'e.visible = true',
                'e.date_debut >= CURRENT_DATE'
              ];
  where_sql text;
  cnt       bigint;
BEGIN
  -- sectors
  IF array_length(sector_ids,1) > 0 THEN
    wheres := wheres || 'e.id_event IN (SELECT event_id FROM event_sectors WHERE sector_id = ANY($1))';
  END IF;

  -- types
  IF array_length(event_types,1) > 0 THEN
    wheres := wheres || 'e.type_event = ANY($2)';
  END IF;

  -- months
  IF array_length(months,1) > 0 THEN
    wheres := wheres || 'EXTRACT(MONTH FROM e.date_debut)::int = ANY($3)';
  END IF;

  -- regions
  IF array_length(region_codes,1) > 0 THEN
    wheres := wheres || 'EXISTS (
                           SELECT 1 FROM events_geo g
                           WHERE g.id_event = e.id_event
                             AND g.region_code = ANY($4)
                         )';
  END IF;

  where_sql := array_to_string(wheres,' AND ');

  EXECUTE
    format('SELECT COUNT(DISTINCT e.id_event) FROM events e WHERE %s', where_sql)
    USING sector_ids, event_types, months, region_codes
    INTO cnt;

  RETURN QUERY EXECUTE
    format($q$
      SELECT DISTINCT
        e.id_event, e.nom_event, e.date_debut, e.date_fin, e.ville, e.secteur,
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
$$;

-- SECTION 2: Create performance indexes
-- ------------------------------------

-- Enable pg_trgm extension if not exists
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Index for commune name searches with unaccent + trgm
CREATE INDEX IF NOT EXISTS idx_communes_nom_trgm
  ON communes USING gin (unaccent(nom) gin_trgm_ops);

-- Index for region name searches
CREATE INDEX IF NOT EXISTS idx_regions_nom_trgm
  ON regions USING gin (unaccent(nom) gin_trgm_ops);

-- Index for department name searches
CREATE INDEX IF NOT EXISTS idx_departements_nom_trgm
  ON departements USING gin (unaccent(nom) gin_trgm_ops);

-- Index for event name searches
CREATE INDEX IF NOT EXISTS idx_events_nom_event_trgm
  ON events USING gin (unaccent(nom_event) gin_trgm_ops);

-- Index for event city searches
CREATE INDEX IF NOT EXISTS idx_events_ville_trgm
  ON events USING gin (unaccent(ville) gin_trgm_ops);

-- SECTION 3: Recreate triggers after function updates
-- ---------------------------------------------------

-- Drop existing triggers
DROP TRIGGER IF EXISTS trg_update_updated_at ON events;
DROP TRIGGER IF EXISTS trg_sync_event_sectors ON events;
DROP TRIGGER IF EXISTS trg_auto_generate_event_slug ON events;
DROP TRIGGER IF EXISTS trg_fill_city_and_postal ON events;
DROP TRIGGER IF EXISTS trg_ensure_commune_region_consistency ON communes;

-- Recreate triggers with updated functions
CREATE TRIGGER trg_update_updated_at
  BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_sync_event_sectors
  AFTER INSERT OR UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION sync_event_sectors();

CREATE TRIGGER trg_auto_generate_event_slug
  BEFORE INSERT OR UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION auto_generate_event_slug();

CREATE TRIGGER trg_fill_city_and_postal
  BEFORE INSERT OR UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION fill_city_and_postal_from_address();

CREATE TRIGGER trg_ensure_commune_region_consistency
  BEFORE INSERT OR UPDATE ON communes
  FOR EACH ROW EXECUTE FUNCTION ensure_commune_region_consistency();

-- SECTION 4: Set proper permissions for SECURITY DEFINER functions
-- ----------------------------------------------------------------

-- Revoke public access and grant to appropriate roles
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM public;
GRANT EXECUTE ON FUNCTION public.update_updated_at_column() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.sync_event_sectors() FROM public;
GRANT EXECUTE ON FUNCTION public.sync_event_sectors() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.auto_generate_event_slug() FROM public;
GRANT EXECUTE ON FUNCTION public.auto_generate_event_slug() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.fill_city_and_postal_from_address() FROM public;
GRANT EXECUTE ON FUNCTION public.fill_city_and_postal_from_address() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.fill_city_from_address() FROM public;
GRANT EXECUTE ON FUNCTION public.fill_city_from_address() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.ensure_commune_region_consistency() FROM public;
GRANT EXECUTE ON FUNCTION public.ensure_commune_region_consistency() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_location_suggestions(text) FROM public;
GRANT EXECUTE ON FUNCTION public.get_location_suggestions(text) TO authenticated, service_role, anon;

REVOKE ALL ON FUNCTION public.search_events(uuid[], text[], integer[], text[], integer, integer) FROM public;
GRANT EXECUTE ON FUNCTION public.search_events(uuid[], text[], integer[], text[], integer, integer) TO authenticated, service_role, anon;

REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM public;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_current_user_role() FROM public;
GRANT EXECUTE ON FUNCTION public.get_current_user_role() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.is_admin() FROM public;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;