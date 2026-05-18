
CREATE OR REPLACE FUNCTION public.parse_affluence_int(p text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p IS NULL THEN NULL
    WHEN regexp_replace(p, '[^0-9]', '', 'g') = '' THEN NULL
    ELSE LEAST(2147483647, NULLIF(regexp_replace(p, '[^0-9]', '', 'g'), '')::bigint)::int
  END;
$$;

CREATE OR REPLACE FUNCTION public.compute_event_enrichissement_score(p_event_id uuid)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  e public.events%ROWTYPE;
  v_affluence_int int;
  v_exhibitors int := 0;
  v_audience int := 0;
  v_content int := 0;
  v_urgency int := 0;
  v_days int;
  v_desc_len int;
BEGIN
  SELECT * INTO e FROM public.events WHERE id = p_event_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  v_affluence_int := public.parse_affluence_int(e.affluence);
  v_audience := v_audience + CASE
    WHEN v_affluence_int IS NULL THEN 0
    WHEN v_affluence_int >= 10000 THEN 25
    WHEN v_affluence_int >= 5000  THEN 20
    WHEN v_affluence_int >= 2000  THEN 15
    WHEN v_affluence_int >= 500   THEN 10
    WHEN v_affluence_int > 0      THEN 5
    ELSE 0
  END;

  SELECT count(*) INTO v_exhibitors FROM public.participation WHERE id_event = e.id;
  v_audience := v_audience + CASE
    WHEN v_exhibitors >= 100 THEN 15
    WHEN v_exhibitors >= 50  THEN 10
    WHEN v_exhibitors >= 20  THEN 7
    WHEN v_exhibitors >= 5   THEN 4
    WHEN v_exhibitors > 0    THEN 2
    ELSE 0
  END;

  v_desc_len := char_length(coalesce(e.description_event, ''));
  v_content := v_content + CASE
    WHEN v_desc_len >= 1500 THEN 15
    WHEN v_desc_len >= 500  THEN 10
    WHEN v_desc_len >= 200  THEN 5
    ELSE 0
  END;
  IF coalesce(e.url_site_officiel, '') <> '' THEN v_content := v_content + 5; END IF;
  IF coalesce(e.url_image, '') <> '' THEN v_content := v_content + 5; END IF;
  IF e.secteur IS NOT NULL AND jsonb_typeof(e.secteur) = 'array' AND jsonb_array_length(e.secteur) > 0 THEN
    v_content := v_content + 5;
  END IF;

  IF e.date_debut IS NOT NULL THEN
    v_days := (e.date_debut - CURRENT_DATE)::int;
    v_urgency := CASE
      WHEN v_days < 0 THEN 0
      WHEN v_days <= 30 THEN 30
      WHEN v_days <= 90 THEN 22
      WHEN v_days <= 180 THEN 15
      WHEN v_days <= 365 THEN 10
      ELSE 5
    END;
  END IF;

  RETURN LEAST(100, v_audience + v_content + v_urgency);
END
$$;

REVOKE ALL ON FUNCTION public.compute_event_enrichissement_score(uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.compute_event_enrichissement_score(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.score_events_batch(
  p_limit int DEFAULT 50,
  p_dry_run boolean DEFAULT true,
  p_only_null boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_processed int := 0;
  v_dist jsonb;
  v_sample jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) AND auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  WITH base AS (
    SELECT e.id, e.nom_event, e.slug, e.date_debut, e.secteur, e.affluence,
           e.description_event, e.enrichissement_score
    FROM public.events e
    WHERE e.visible = true
      AND coalesce(e.is_test, false) = false
      AND e.slug IS NOT NULL AND e.slug <> ''
      AND e.date_debut >= CURRENT_DATE
      AND (
        e.description_enrichie IS NULL
        OR e.enrichissement_score IS NULL
        OR coalesce(e.enrichissement_statut, '') <> 'valide'
      )
      AND (NOT p_only_null OR e.enrichissement_score IS NULL)
  ),
  prio AS (
    SELECT b.*,
      (SELECT count(*) FROM public.participation p WHERE p.id_event = b.id) AS exhibitors_count,
      (b.date_debut >= '2026-01-01' AND b.date_debut < '2027-01-01')::int AS is_2026,
      (EXISTS (
         SELECT 1 FROM jsonb_array_elements_text(
           CASE WHEN jsonb_typeof(b.secteur) = 'array' THEN b.secteur ELSE '[]'::jsonb END
         ) s
         WHERE lower(s) ~ '(santé|medical|médical|tourisme|événementiel|evenementiel|industrie|production|btp|construction|agroalimentaire|agriculture|boisson)'
      ))::int AS sector_priority,
      char_length(coalesce(b.description_event,'')) AS desc_len
    FROM base b
  ),
  ranked AS (
    SELECT * FROM prio
    ORDER BY (exhibitors_count > 0)::int DESC, is_2026 DESC, sector_priority DESC, desc_len ASC, date_debut ASC
    LIMIT p_limit
  )
  SELECT jsonb_agg(jsonb_build_object(
    'id', id, 'nom_event', nom_event, 'slug', slug, 'date_debut', date_debut,
    'exhibitors', exhibitors_count, 'is_2026', is_2026::bool, 'sector_priority', sector_priority::bool,
    'desc_len', desc_len, 'current_score', enrichissement_score,
    'computed_score', public.compute_event_enrichissement_score(id)
  ) ORDER BY date_debut)
  INTO v_sample
  FROM ranked;

  IF NOT p_dry_run THEN
    WITH base AS (
      SELECT e.id, e.date_debut, e.secteur, e.description_event
      FROM public.events e
      WHERE e.visible = true
        AND coalesce(e.is_test, false) = false
        AND e.slug IS NOT NULL AND e.slug <> ''
        AND e.date_debut >= CURRENT_DATE
        AND (
          e.description_enrichie IS NULL
          OR e.enrichissement_score IS NULL
          OR coalesce(e.enrichissement_statut, '') <> 'valide'
        )
        AND (NOT p_only_null OR e.enrichissement_score IS NULL)
    ),
    prio AS (
      SELECT b.*,
        (SELECT count(*) FROM public.participation p WHERE p.id_event = b.id) AS exhibitors_count,
        (b.date_debut >= '2026-01-01' AND b.date_debut < '2027-01-01')::int AS is_2026,
        (EXISTS (
           SELECT 1 FROM jsonb_array_elements_text(
             CASE WHEN jsonb_typeof(b.secteur) = 'array' THEN b.secteur ELSE '[]'::jsonb END
           ) s
           WHERE lower(s) ~ '(santé|medical|médical|tourisme|événementiel|evenementiel|industrie|production|btp|construction|agroalimentaire|agriculture|boisson)'
        ))::int AS sector_priority,
        char_length(coalesce(b.description_event,'')) AS desc_len
      FROM base b
    ),
    ranked AS (
      SELECT id FROM prio
      ORDER BY (exhibitors_count > 0)::int DESC, is_2026 DESC, sector_priority DESC, desc_len ASC, date_debut ASC
      LIMIT p_limit
    ),
    scored AS (
      SELECT id, public.compute_event_enrichissement_score(id) AS s FROM ranked
    )
    UPDATE public.events ev
    SET enrichissement_score = s.s,
        enrichissement_niveau = CASE
          WHEN s.s >= 65 THEN 'premium'
          WHEN s.s >= 35 THEN 'standard'
          ELSE 'minimal'
        END,
        updated_at = now()
    FROM scored s
    WHERE ev.id = s.id;
    GET DIAGNOSTICS v_processed = ROW_COUNT;
  END IF;

  SELECT jsonb_build_object(
    'total', count(*),
    'score_null', count(*) FILTER (WHERE enrichissement_score IS NULL),
    'score_lt_35', count(*) FILTER (WHERE enrichissement_score < 35),
    'score_35_54', count(*) FILTER (WHERE enrichissement_score BETWEEN 35 AND 54),
    'score_gte_55', count(*) FILTER (WHERE enrichissement_score >= 55)
  ) INTO v_dist
  FROM public.events
  WHERE visible=true AND coalesce(is_test,false)=false
    AND slug IS NOT NULL AND slug <> ''
    AND date_debut >= CURRENT_DATE;

  RETURN jsonb_build_object(
    'dry_run', p_dry_run,
    'requested_limit', p_limit,
    'processed', v_processed,
    'distribution_after', v_dist,
    'sample', v_sample
  );
END
$$;

REVOKE ALL ON FUNCTION public.score_events_batch(int, boolean, boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.score_events_batch(int, boolean, boolean) TO authenticated, service_role;
