
ALTER TABLE public.crm_company_event_matches
  ADD COLUMN IF NOT EXISTS name_similarity numeric(4,3),
  ADD COLUMN IF NOT EXISTS needs_review boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS review_reason text;

CREATE INDEX IF NOT EXISTS idx_crm_matches_user_needs_review
  ON public.crm_company_event_matches(user_id, needs_review);

ALTER TABLE public.crm_imports
  ADD COLUMN IF NOT EXISTS suspicious_rate numeric(5,4);

CREATE OR REPLACE FUNCTION public.crm_normalize_company_name(p_name text)
RETURNS text
LANGUAGE sql
STABLE
SET search_path = public, extensions
AS $$
  SELECT NULLIF(
    btrim(
      regexp_replace(
        regexp_replace(
          lower(extensions.unaccent(coalesce(p_name, ''))),
          '\m(sa|sas|sasu|sarl|eurl|sci|snc|scop|gmbh|ltd|llc|inc|corp|co|company|group|groupe|holding|plc|ag|nv|bv|spa|srl)\M',
          ' ', 'g'
        ),
        '[^a-z0-9]+', ' ', 'g'
      )
    ),
    ''
  );
$$;

CREATE OR REPLACE FUNCTION public.crm_compute_match_review(
  p_crm_name text, p_exhibitor_name text
)
RETURNS TABLE(name_similarity numeric, needs_review boolean, review_reason text)
LANGUAGE plpgsql
STABLE
SET search_path = public, extensions
AS $$
DECLARE
  a text := public.crm_normalize_company_name(p_crm_name);
  b text := public.crm_normalize_company_name(p_exhibitor_name);
  s numeric;
  contained boolean;
BEGIN
  IF a IS NULL OR b IS NULL THEN
    RETURN QUERY SELECT NULL::numeric, false, NULL::text;
    RETURN;
  END IF;
  contained := (position(a in b) > 0 OR position(b in a) > 0);
  s := GREATEST(extensions.similarity(a, b), CASE WHEN contained THEN 0.6 ELSE 0 END);
  s := round(s::numeric, 3);
  IF s < 0.35 THEN
    RETURN QUERY SELECT s, true, 'crm_name_exhibitor_name_mismatch'::text;
  ELSE
    RETURN QUERY SELECT s, false, NULL::text;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.crm_run_matching(p_import_id uuid, p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_inserted_match_ids uuid[] := ARRAY[]::uuid[];
  v_inserted_matches int := 0;
  v_matched_companies int := 0;
  v_unmatched_companies int := 0;
  v_total_companies int := 0;
  v_future_matches int := 0;
  v_past_matches int := 0;
  v_new_matches jsonb := '[]'::jsonb;
  v_needs_review_count int := 0;
  v_total_for_import int := 0;
  v_flagged_for_import int := 0;
  v_suspicious_rate numeric;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.crm_imports
    WHERE id = p_import_id AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'Import not found or not owned by user';
  END IF;

  WITH inserted AS (
    INSERT INTO public.crm_company_event_matches (
      user_id, crm_company_id, id_exposant, event_id, normalized_domain, match_type, match_status
    )
    SELECT
      c.user_id, c.id, r.id_exposant, r.event_id, r.normalized_domain,
      'exact_domain', 'confirmed'
    FROM public.crm_companies c
    JOIN public.crm_radar_participations_view r
      ON r.normalized_domain = c.normalized_domain
     AND r.normalized_domain IS NOT NULL
     AND r.normalized_domain <> ''
     AND r.visible = true
    WHERE c.import_id = p_import_id AND c.user_id = p_user_id
    ON CONFLICT (crm_company_id, id_exposant, event_id) DO NOTHING
    RETURNING id
  )
  SELECT COALESCE(array_agg(id), ARRAY[]::uuid[])
  INTO v_inserted_match_ids
  FROM inserted;

  v_inserted_matches := COALESCE(array_length(v_inserted_match_ids, 1), 0);

  IF v_inserted_matches > 0 THEN
    UPDATE public.crm_company_event_matches m
    SET name_similarity = s.name_similarity,
        needs_review    = s.needs_review,
        review_reason   = s.review_reason
    FROM (
      SELECT
        m2.id AS match_id,
        r.name_similarity, r.needs_review, r.review_reason
      FROM public.crm_company_event_matches m2
      JOIN public.crm_companies c ON c.id = m2.crm_company_id
      JOIN public.exposants ex    ON ex.id_exposant = m2.id_exposant
      CROSS JOIN LATERAL public.crm_compute_match_review(c.company_name, ex.nom_exposant) r
      WHERE m2.id = ANY(v_inserted_match_ids)
    ) s
    WHERE m.id = s.match_id;
  END IF;

  SELECT COALESCE(
    jsonb_agg(to_jsonb(d) ORDER BY (d.is_future_event)::int DESC),
    '[]'::jsonb
  )
  INTO v_new_matches
  FROM (
    SELECT
      m.id AS match_id,
      m.crm_company_id,
      c.company_name,
      c.import_id,
      m.id_exposant,
      ex.nom_exposant,
      m.event_id,
      e.nom_event,
      m.normalized_domain,
      m.name_similarity,
      m.needs_review,
      m.review_reason,
      (e.date_debut >= CURRENT_DATE) AS is_future_event
    FROM public.crm_company_event_matches m
    JOIN public.crm_companies c ON c.id = m.crm_company_id
    LEFT JOIN public.exposants ex ON ex.id_exposant = m.id_exposant
    LEFT JOIN public.events e ON e.id = m.event_id
    WHERE m.id = ANY(v_inserted_match_ids)
  ) d;

  SELECT count(*) INTO v_total_companies
  FROM public.crm_companies
  WHERE import_id = p_import_id AND user_id = p_user_id;

  SELECT count(DISTINCT m.crm_company_id) INTO v_matched_companies
  FROM public.crm_company_event_matches m
  JOIN public.crm_companies c ON c.id = m.crm_company_id
  WHERE c.import_id = p_import_id AND c.user_id = p_user_id;

  v_unmatched_companies := GREATEST(v_total_companies - v_matched_companies, 0);

  SELECT
    count(*) FILTER (WHERE e.date_debut >= CURRENT_DATE),
    count(*) FILTER (WHERE e.date_debut < CURRENT_DATE)
  INTO v_future_matches, v_past_matches
  FROM public.crm_company_event_matches m
  JOIN public.crm_companies c ON c.id = m.crm_company_id
  JOIN public.events e ON e.id = m.event_id
  WHERE c.import_id = p_import_id AND c.user_id = p_user_id;

  SELECT
    count(*),
    count(*) FILTER (WHERE m.needs_review)
  INTO v_total_for_import, v_flagged_for_import
  FROM public.crm_company_event_matches m
  JOIN public.crm_companies c ON c.id = m.crm_company_id
  WHERE c.import_id = p_import_id;

  v_needs_review_count := v_flagged_for_import;

  v_suspicious_rate := CASE
    WHEN v_total_for_import = 0 THEN NULL
    ELSE round(v_flagged_for_import::numeric / v_total_for_import::numeric, 4)
  END;

  UPDATE public.crm_imports
  SET suspicious_rate = v_suspicious_rate,
      updated_at = now()
  WHERE id = p_import_id;

  RETURN jsonb_build_object(
    'matchesCount', v_inserted_matches,
    'totalCompanies', v_total_companies,
    'matchedCompaniesCount', v_matched_companies,
    'unmatchedCompaniesCount', v_unmatched_companies,
    'futureMatchesCount', v_future_matches,
    'pastMatchesCount', v_past_matches,
    'newMatches', v_new_matches,
    'needsReviewCount', v_needs_review_count,
    'suspiciousRate', v_suspicious_rate
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.crm_run_matching(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.crm_run_matching(uuid, uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.crm_run_matching(uuid, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.crm_backfill_match_review()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_processed_matches int := 0;
  v_flagged_matches int := 0;
  v_processed_imports int := 0;
  v_suspicious_imports int := 0;
BEGIN
  WITH upd AS (
    UPDATE public.crm_company_event_matches m
    SET name_similarity = s.name_similarity,
        needs_review    = s.needs_review,
        review_reason   = s.review_reason
    FROM (
      SELECT m2.id AS match_id, r.name_similarity, r.needs_review, r.review_reason
      FROM public.crm_company_event_matches m2
      JOIN public.crm_companies c ON c.id = m2.crm_company_id
      JOIN public.exposants ex   ON ex.id_exposant = m2.id_exposant
      CROSS JOIN LATERAL public.crm_compute_match_review(c.company_name, ex.nom_exposant) r
    ) s
    WHERE m.id = s.match_id
    RETURNING m.id, m.needs_review
  )
  SELECT count(*), count(*) FILTER (WHERE needs_review)
  INTO v_processed_matches, v_flagged_matches
  FROM upd;

  WITH per_import AS (
    SELECT c.import_id,
           count(*) AS total,
           count(*) FILTER (WHERE m.needs_review) AS flagged
    FROM public.crm_company_event_matches m
    JOIN public.crm_companies c ON c.id = m.crm_company_id
    GROUP BY c.import_id
  ),
  upd_imp AS (
    UPDATE public.crm_imports i
    SET suspicious_rate = CASE WHEN p.total = 0 THEN NULL
                               ELSE round(p.flagged::numeric / p.total::numeric, 4) END,
        updated_at = now()
    FROM per_import p
    WHERE i.id = p.import_id
    RETURNING i.id, i.suspicious_rate
  )
  SELECT count(*), count(*) FILTER (WHERE suspicious_rate > 0.30)
  INTO v_processed_imports, v_suspicious_imports
  FROM upd_imp;

  RETURN jsonb_build_object(
    'processedMatches', v_processed_matches,
    'flaggedMatches', v_flagged_matches,
    'processedImports', v_processed_imports,
    'suspiciousImports', v_suspicious_imports
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.crm_backfill_match_review() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.crm_backfill_match_review() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.crm_backfill_match_review() TO service_role;

CREATE OR REPLACE FUNCTION public.get_radar_crm_admin_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_total_imports int; v_failed int; v_distinct_users int;
  v_companies int; v_matches int;
  v_avg_companies numeric; v_avg_match_rate numeric;
  v_future int; v_past int; v_recent jsonb;
  v_beta_users int; v_alerts_enabled int; v_data_deletions int;
  v_needs_review_matches int; v_suspicious_imports int;
  v_recent_suspicious jsonb;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Forbidden'; END IF;

  SELECT count(*) INTO v_total_imports FROM public.crm_imports;
  SELECT count(*) INTO v_failed FROM public.crm_imports WHERE status = 'failed';
  SELECT count(DISTINCT user_id) INTO v_distinct_users FROM public.crm_imports;
  SELECT count(*) INTO v_companies FROM public.crm_companies;
  SELECT count(*) INTO v_matches FROM public.crm_company_event_matches;

  SELECT COALESCE(round(avg(total_rows)::numeric, 1), 0)
    INTO v_avg_companies FROM public.crm_imports WHERE status = 'completed';

  SELECT COALESCE(round(avg(
    CASE WHEN total_rows > 0 THEN matched_companies_count::numeric / total_rows::numeric * 100 ELSE 0 END
  )::numeric, 1), 0)
    INTO v_avg_match_rate FROM public.crm_imports WHERE status = 'completed';

  SELECT count(*) INTO v_future FROM public.crm_company_event_matches m
    JOIN public.events e ON e.id = m.event_id WHERE e.date_debut >= CURRENT_DATE;
  SELECT count(*) INTO v_past FROM public.crm_company_event_matches m
    JOIN public.events e ON e.id = m.event_id WHERE e.date_debut < CURRENT_DATE;

  SELECT count(*) INTO v_beta_users FROM public.user_radar_access WHERE access_status = 'beta';
  SELECT count(*) INTO v_alerts_enabled FROM public.crm_notification_preferences WHERE radar_alerts_enabled = true;
  SELECT count(*) INTO v_data_deletions FROM public.crm_usage_events WHERE event_type = 'radar_data_deleted';

  SELECT count(*) INTO v_needs_review_matches
    FROM public.crm_company_event_matches WHERE needs_review = true;
  SELECT count(*) INTO v_suspicious_imports
    FROM public.crm_imports WHERE suspicious_rate IS NOT NULL AND suspicious_rate > 0.30;

  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO v_recent FROM (
    SELECT i.id,
      (SELECT email FROM auth.users u WHERE u.id = i.user_id) AS user_email,
      i.file_name, i.source_type, i.status,
      COALESCE(i.total_rows, 0) AS total_rows,
      COALESCE(i.matched_companies_count, 0) AS matched_companies_count,
      COALESCE(i.unmatched_companies_count, 0) AS unmatched_companies_count,
      i.error_message, i.created_at, i.suspicious_rate
    FROM public.crm_imports i ORDER BY i.created_at DESC LIMIT 50
  ) t;

  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO v_recent_suspicious FROM (
    SELECT i.id,
      (SELECT email FROM auth.users u WHERE u.id = i.user_id) AS user_email,
      i.file_name, i.status,
      COALESCE(i.total_rows, 0) AS total_rows,
      COALESCE(i.matched_companies_count, 0) AS matched_companies_count,
      i.suspicious_rate, i.created_at
    FROM public.crm_imports i
    WHERE i.suspicious_rate IS NOT NULL AND i.suspicious_rate > 0.30
    ORDER BY i.created_at DESC LIMIT 30
  ) t;

  RETURN jsonb_build_object(
    'totalImports', v_total_imports,
    'failedImports', v_failed,
    'distinctUsers', v_distinct_users,
    'totalCompanies', v_companies,
    'totalMatches', v_matches,
    'avgCompaniesPerImport', v_avg_companies,
    'avgMatchRate', v_avg_match_rate,
    'futureMatches', v_future,
    'pastMatches', v_past,
    'recentImports', v_recent,
    'betaUsers', v_beta_users,
    'alertsEnabledUsers', v_alerts_enabled,
    'dataDeletions', v_data_deletions,
    'needsReviewMatches', v_needs_review_matches,
    'suspiciousImports', v_suspicious_imports,
    'recentSuspiciousImports', v_recent_suspicious
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.get_radar_crm_admin_stats() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_radar_crm_admin_stats() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_radar_crm_admin_stats() TO authenticated;
