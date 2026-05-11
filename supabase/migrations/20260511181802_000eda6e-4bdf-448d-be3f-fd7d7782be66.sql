CREATE OR REPLACE FUNCTION public.normalize_company_name(input text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $fn$
  SELECT CASE
    WHEN input IS NULL OR length(btrim(input)) = 0 THEN ''
    ELSE btrim(regexp_replace(regexp_replace(lower(extensions.unaccent('extensions.unaccent'::regdictionary, input)), '[^a-z0-9]+', ' ', 'g'), '\s+', ' ', 'g'))
  END;
$fn$;

ALTER TABLE public.exhibitors ADD COLUMN IF NOT EXISTS name_normalized text;

CREATE OR REPLACE FUNCTION public.set_exhibitors_name_normalized()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $fn$
BEGIN
  NEW.name_normalized := public.normalize_company_name(NEW.name);
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_exhibitors_name_normalized ON public.exhibitors;
CREATE TRIGGER trg_exhibitors_name_normalized
BEFORE INSERT OR UPDATE OF name ON public.exhibitors
FOR EACH ROW EXECUTE FUNCTION public.set_exhibitors_name_normalized();

UPDATE public.exhibitors
SET name_normalized = public.normalize_company_name(name)
WHERE name_normalized IS DISTINCT FROM public.normalize_company_name(name);

CREATE INDEX IF NOT EXISTS idx_exhibitors_name_normalized_trgm
ON public.exhibitors USING gin (name_normalized extensions.gin_trgm_ops);

ALTER TABLE public.exposants ADD COLUMN IF NOT EXISTS nom_normalized text;

CREATE OR REPLACE FUNCTION public.set_exposants_nom_normalized()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $fn$
BEGIN
  NEW.nom_normalized := public.normalize_company_name(NEW.nom_exposant);
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_exposants_nom_normalized ON public.exposants;
CREATE TRIGGER trg_exposants_nom_normalized
BEFORE INSERT OR UPDATE OF nom_exposant ON public.exposants
FOR EACH ROW EXECUTE FUNCTION public.set_exposants_nom_normalized();

UPDATE public.exposants
SET nom_normalized = public.normalize_company_name(nom_exposant)
WHERE nom_normalized IS DISTINCT FROM public.normalize_company_name(nom_exposant);

CREATE INDEX IF NOT EXISTS idx_exposants_nom_normalized_trgm
ON public.exposants USING gin (nom_normalized extensions.gin_trgm_ops);

ALTER TABLE public.outreach_campaigns ADD COLUMN IF NOT EXISTS company_name_normalized text;

CREATE OR REPLACE FUNCTION public.set_outreach_company_name_normalized()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $fn$
BEGIN
  NEW.company_name_normalized := public.normalize_company_name(NEW.company_name);
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_outreach_company_name_normalized ON public.outreach_campaigns;
CREATE TRIGGER trg_outreach_company_name_normalized
BEFORE INSERT OR UPDATE OF company_name ON public.outreach_campaigns
FOR EACH ROW EXECUTE FUNCTION public.set_outreach_company_name_normalized();

UPDATE public.outreach_campaigns
SET company_name_normalized = public.normalize_company_name(company_name)
WHERE company_name_normalized IS DISTINCT FROM public.normalize_company_name(company_name);

CREATE INDEX IF NOT EXISTS idx_outreach_company_name_normalized_trgm
ON public.outreach_campaigns USING gin (company_name_normalized extensions.gin_trgm_ops);

DROP FUNCTION IF EXISTS public.search_admin_companies(text, integer);

CREATE OR REPLACE FUNCTION public.search_admin_companies(q text, lim integer DEFAULT 50)
RETURNS TABLE(
  source text,
  source_priority integer,
  exhibitor_id uuid,
  legacy_id text,
  outreach_id uuid,
  event_id uuid,
  name text,
  website text,
  contact_email text,
  campaign_status text,
  current_step integer,
  has_exhibitor_row boolean,
  relevance real
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  norm text;
  patterns text[];
  per_source_lim integer;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  norm := public.normalize_company_name(q);
  IF norm IS NULL OR length(norm) = 0 THEN
    RETURN;
  END IF;

  SELECT array_agg('%' || token || '%') INTO patterns
  FROM unnest(regexp_split_to_array(norm, ' ')) AS token
  WHERE length(token) > 0;

  IF patterns IS NULL OR array_length(patterns, 1) = 0 THEN
    RETURN;
  END IF;

  per_source_lim := GREATEST(lim * 3, 60);

  RETURN QUERY
  WITH
  src_exhibitors AS (
    SELECT
      'exhibitor'::text AS source,
      1 AS source_priority,
      e.id AS exhibitor_id,
      NULL::text AS legacy_id,
      NULL::uuid AS outreach_id,
      NULL::uuid AS event_id,
      e.name AS name,
      e.website AS website,
      e.contact_email AS contact_email,
      e.campaign_status AS campaign_status,
      e.current_step AS current_step,
      true AS has_exhibitor_row,
      extensions.similarity(e.name_normalized, norm) AS relevance,
      e.name_normalized AS name_norm
    FROM public.exhibitors e
    WHERE e.name_normalized LIKE ALL (patterns)
    LIMIT per_source_lim
  ),
  src_outreach AS (
    SELECT
      'outreach'::text AS source,
      2 AS source_priority,
      oc.exhibitor_id AS exhibitor_id,
      oc.id_exposant_legacy AS legacy_id,
      oc.id AS outreach_id,
      oc.event_id AS event_id,
      oc.company_name AS name,
      oc.website AS website,
      oc.contact_email AS contact_email,
      oc.campaign_status AS campaign_status,
      oc.current_step AS current_step,
      (oc.exhibitor_id IS NOT NULL) AS has_exhibitor_row,
      extensions.similarity(oc.company_name_normalized, norm) AS relevance,
      oc.company_name_normalized AS name_norm
    FROM public.outreach_campaigns oc
    WHERE oc.company_name_normalized LIKE ALL (patterns)
    LIMIT per_source_lim
  ),
  src_legacy AS (
    SELECT
      'legacy'::text AS source,
      3 AS source_priority,
      NULL::uuid AS exhibitor_id,
      ex.id_exposant AS legacy_id,
      NULL::uuid AS outreach_id,
      NULL::uuid AS event_id,
      ex.nom_exposant AS name,
      ex.website_exposant AS website,
      NULL::text AS contact_email,
      NULL::text AS campaign_status,
      NULL::integer AS current_step,
      false AS has_exhibitor_row,
      extensions.similarity(ex.nom_normalized, norm) AS relevance,
      ex.nom_normalized AS name_norm
    FROM public.exposants ex
    WHERE ex.nom_normalized LIKE ALL (patterns)
    LIMIT per_source_lim
  ),
  src AS (
    SELECT * FROM src_exhibitors
    UNION ALL
    SELECT * FROM src_outreach
    UNION ALL
    SELECT * FROM src_legacy
  ),
  ranked AS (
    SELECT DISTINCT ON (s.name_norm, lower(coalesce(s.website, '')))
      s.source, s.source_priority, s.exhibitor_id, s.legacy_id, s.outreach_id,
      s.event_id, s.name, s.website, s.contact_email, s.campaign_status,
      s.current_step, s.has_exhibitor_row, s.relevance
    FROM src s
    ORDER BY s.name_norm, lower(coalesce(s.website, '')), s.source_priority ASC, s.relevance DESC
  )
  SELECT
    r.source, r.source_priority, r.exhibitor_id, r.legacy_id, r.outreach_id,
    r.event_id, r.name, r.website, r.contact_email, r.campaign_status,
    r.current_step, r.has_exhibitor_row, r.relevance
  FROM ranked r
  ORDER BY r.source_priority ASC, r.relevance DESC NULLS LAST, r.name ASC
  LIMIT lim;
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.search_admin_companies(text, integer) TO authenticated;