-- Stats correctes basées sur la jointure réelle
CREATE OR REPLACE FUNCTION public.get_exhibitor_ai_enrichment_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total int;
  v_enriched_valid int;
  v_orphan int;
  v_remaining_with_site int;
  v_remaining_total int;
BEGIN
  IF auth.role() <> 'service_role' AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT count(*) INTO v_total
  FROM public.exposants
  WHERE id_exposant IS NOT NULL;

  SELECT count(*) INTO v_enriched_valid
  FROM public.exhibitor_ai a
  WHERE EXISTS (SELECT 1 FROM public.exposants e WHERE e.id_exposant = a.exhibitor_id);

  SELECT count(*) INTO v_orphan
  FROM public.exhibitor_ai a
  WHERE NOT EXISTS (SELECT 1 FROM public.exposants e WHERE e.id_exposant = a.exhibitor_id);

  SELECT count(*) INTO v_remaining_with_site
  FROM public.exposants e
  WHERE e.id_exposant IS NOT NULL
    AND e.website_exposant IS NOT NULL
    AND e.website_exposant <> ''
    AND NOT EXISTS (SELECT 1 FROM public.exhibitor_ai a WHERE a.exhibitor_id = e.id_exposant);

  SELECT count(*) INTO v_remaining_total
  FROM public.exposants e
  WHERE e.id_exposant IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.exhibitor_ai a WHERE a.exhibitor_id = e.id_exposant);

  RETURN jsonb_build_object(
    'total_exposants', v_total,
    'enriched_valid', v_enriched_valid,
    'orphan_ai_rows', v_orphan,
    'remaining_with_site', v_remaining_with_site,
    'remaining_total', v_remaining_total
  );
END;
$$;

-- Liste paginée des exposants à enrichir (anti-jointure, ordre stable, limit après filtre)
CREATE OR REPLACE FUNCTION public.list_exposants_to_enrich(p_limit int DEFAULT 50)
RETURNS TABLE(
  id_exposant text,
  nom_exposant text,
  website_exposant text,
  exposant_description text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() <> 'service_role' AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  RETURN QUERY
  SELECT e.id_exposant, e.nom_exposant, e.website_exposant, e.exposant_description
  FROM public.exposants e
  LEFT JOIN public.exhibitor_ai a ON a.exhibitor_id = e.id_exposant
  WHERE e.id_exposant IS NOT NULL
    AND e.website_exposant IS NOT NULL
    AND e.website_exposant <> ''
    AND a.exhibitor_id IS NULL
  ORDER BY e.created_at ASC NULLS LAST, e.id_exposant ASC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 50), 200));
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_exhibitor_ai_enrichment_stats() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.list_exposants_to_enrich(int) TO authenticated, service_role;