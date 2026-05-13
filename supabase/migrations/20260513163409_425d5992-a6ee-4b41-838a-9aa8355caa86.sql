
-- 1) Update crm_run_matching to also return the list of newMatches inserted in this call.
CREATE OR REPLACE FUNCTION public.crm_run_matching(p_import_id uuid, p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_inserted_matches int := 0;
  v_matched_companies int := 0;
  v_unmatched_companies int := 0;
  v_total_companies int := 0;
  v_future_matches int := 0;
  v_past_matches int := 0;
  v_new_matches jsonb := '[]'::jsonb;
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
      c.user_id,
      c.id,
      r.id_exposant,
      r.event_id,
      r.normalized_domain,
      'exact_domain',
      'confirmed'
    FROM public.crm_companies c
    JOIN public.crm_radar_participations_view r
      ON r.normalized_domain = c.normalized_domain
     AND r.normalized_domain IS NOT NULL
     AND r.normalized_domain <> ''
     AND r.visible = true
    WHERE c.import_id = p_import_id
      AND c.user_id = p_user_id
    ON CONFLICT (crm_company_id, id_exposant, event_id) DO NOTHING
    RETURNING id, crm_company_id, id_exposant, event_id, normalized_domain
  ),
  detail AS (
    SELECT
      i.id            AS match_id,
      i.crm_company_id,
      c.company_name,
      c.import_id,
      i.id_exposant,
      i.event_id,
      i.normalized_domain,
      (e.date_debut >= CURRENT_DATE) AS is_future_event,
      e.nom_event
    FROM inserted i
    JOIN public.crm_companies c ON c.id = i.crm_company_id
    LEFT JOIN public.events e ON e.id = i.event_id
  )
  SELECT
    count(*),
    COALESCE(jsonb_agg(to_jsonb(detail)), '[]'::jsonb)
  INTO v_inserted_matches, v_new_matches
  FROM detail;

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

  RETURN jsonb_build_object(
    'matchesCount', v_inserted_matches,
    'totalCompanies', v_total_companies,
    'matchedCompaniesCount', v_matched_companies,
    'unmatchedCompaniesCount', v_unmatched_companies,
    'futureMatchesCount', v_future_matches,
    'pastMatchesCount', v_past_matches,
    'newMatches', v_new_matches
  );
END;
$function$;

-- Lock down: only backend / service_role may execute this function directly.
REVOKE EXECUTE ON FUNCTION public.crm_run_matching(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.crm_run_matching(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.crm_run_matching(uuid, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.crm_run_matching(uuid, uuid) TO service_role;

-- 2) Backfill user_radar_access for users with completed imports
INSERT INTO public.user_radar_access (user_id, access_status)
SELECT DISTINCT i.user_id, 'beta'
FROM public.crm_imports i
WHERE i.status = 'completed'
  AND NOT EXISTS (
    SELECT 1 FROM public.user_radar_access a WHERE a.user_id = i.user_id
  )
ON CONFLICT (user_id) DO NOTHING;
