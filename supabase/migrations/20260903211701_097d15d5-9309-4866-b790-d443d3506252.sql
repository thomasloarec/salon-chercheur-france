CREATE OR REPLACE FUNCTION public.get_prerender_exhibitor_profiles(
  p_after text DEFAULT '',
  p_limit int DEFAULT 1000
)
RETURNS TABLE (
  public_slug text,
  display_name text,
  canonical_name text,
  description text,
  ai_summary text,
  website text,
  logo_url text,
  linkedin_url text,
  exhibitor_id uuid,
  legacy_exposant_id text,
  seo_indexable boolean,
  is_test boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    mv.public_slug::text,
    mv.display_name::text,
    mv.canonical_name::text,
    mv.description::text,
    mv.ai_summary::text,
    mv.website::text,
    mv.logo_url::text,
    mv.linkedin_url::text,
    mv.exhibitor_id,
    mv.legacy_exposant_id::text,
    mv.seo_indexable,
    mv.is_test
  FROM public.public_exhibitor_profiles_mv mv
  WHERE mv.is_test IS NOT TRUE
    AND mv.public_slug IS NOT NULL
    AND mv.public_slug <> ''
    AND mv.public_slug > COALESCE(p_after, '')
  ORDER BY mv.public_slug ASC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 1000), 1), 2000);
$$;

REVOKE ALL ON FUNCTION public.get_prerender_exhibitor_profiles(text, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_prerender_exhibitor_profiles(text, int) TO anon, authenticated, service_role;