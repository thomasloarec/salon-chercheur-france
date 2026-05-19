
CREATE OR REPLACE FUNCTION public.seo_test_hash_protection()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_is_service boolean;
  v_results jsonb;
  v_tested int;
  v_skip int;
  v_no_skip int;
BEGIN
  BEGIN v_is_service := (auth.role() = 'service_role'); EXCEPTION WHEN OTHERS THEN v_is_service := false; END;
  IF NOT (v_is_service OR public.has_role(auth.uid(), 'admin'::app_role)) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT jsonb_agg(jsonb_build_object(
    'id', e.id,
    'nom_event', e.nom_event,
    'slug', e.slug,
    'enrichissement_statut', e.enrichissement_statut,
    'description_enrichie_present', (e.description_enrichie IS NOT NULL AND length(btrim(e.description_enrichie)) > 0),
    'stored_hash', e.seo_generated_from_hash,
    'current_hash', public.compute_seo_source_hash(e.id),
    'hash_matches', (e.seo_generated_from_hash = public.compute_seo_source_hash(e.id)),
    'would_skip', (
      e.description_enrichie IS NOT NULL
      AND length(btrim(e.description_enrichie)) > 0
      AND e.enrichissement_statut = 'valide'
      AND e.seo_generated_from_hash = public.compute_seo_source_hash(e.id)
    ),
    'skip_reason', CASE
      WHEN e.seo_generated_from_hash = public.compute_seo_source_hash(e.id)
        THEN 'already_up_to_date_hash_match'
      ELSE 'source_changed_or_missing'
    END
  ) ORDER BY e.date_debut)
  INTO v_results
  FROM (
    SELECT * FROM public.events
    WHERE visible = true
      AND coalesce(is_test, false) = false
      AND enrichissement_statut = 'valide'
      AND description_enrichie IS NOT NULL
      AND length(btrim(description_enrichie)) > 0
      AND seo_generated_from_hash IS NOT NULL
      AND slug IS NOT NULL AND slug <> ''
      AND date_debut >= CURRENT_DATE
    ORDER BY date_debut ASC
    LIMIT 5
  ) e;

  v_results := coalesce(v_results, '[]'::jsonb);
  v_tested := jsonb_array_length(v_results);

  SELECT
    count(*) FILTER (WHERE (x->>'would_skip')::boolean = true),
    count(*) FILTER (WHERE (x->>'would_skip')::boolean = false)
  INTO v_skip, v_no_skip
  FROM jsonb_array_elements(v_results) x;

  RETURN jsonb_build_object(
    'tested_count', v_tested,
    'would_skip_count', coalesce(v_skip, 0),
    'would_not_skip_count', coalesce(v_no_skip, 0),
    'all_would_skip', (v_tested > 0 AND coalesce(v_no_skip, 0) = 0),
    'warning', CASE WHEN v_tested = 0 THEN 'no_valid_events_found' ELSE NULL END,
    'claude_called', false,
    'vercel_triggered', false,
    'results', v_results
  );
END;
$$;
REVOKE ALL ON FUNCTION public.seo_test_hash_protection() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.seo_test_hash_protection() TO authenticated, service_role;
