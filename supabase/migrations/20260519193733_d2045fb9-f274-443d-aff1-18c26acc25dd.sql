
REVOKE ALL ON FUNCTION public.compute_seo_source_hash(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.compute_seo_source_hash(uuid) TO service_role;
