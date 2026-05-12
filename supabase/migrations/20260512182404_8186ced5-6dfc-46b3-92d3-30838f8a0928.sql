
-- Radar CRM: usage tracking + matching helper + admin stats RPC

CREATE TABLE IF NOT EXISTS public.crm_usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_usage_events_type_created ON public.crm_usage_events(event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_usage_events_user ON public.crm_usage_events(user_id);

ALTER TABLE public.crm_usage_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can insert usage events" ON public.crm_usage_events;
CREATE POLICY "Anyone can insert usage events"
  ON public.crm_usage_events
  FOR INSERT
  WITH CHECK (
    user_id IS NULL OR user_id = auth.uid()
  );

DROP POLICY IF EXISTS "Admins can read usage events" ON public.crm_usage_events;
CREATE POLICY "Admins can read usage events"
  ON public.crm_usage_events
  FOR SELECT
  USING (public.is_admin());

-- Matching function used by the crm-import edge function
CREATE OR REPLACE FUNCTION public.crm_run_matching(p_import_id uuid, p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted_matches int := 0;
  v_matched_companies int := 0;
  v_unmatched_companies int := 0;
  v_total_companies int := 0;
  v_future_matches int := 0;
  v_past_matches int := 0;
BEGIN
  -- Verify the import belongs to the user
  IF NOT EXISTS (
    SELECT 1 FROM public.crm_imports
    WHERE id = p_import_id AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'Import not found or not owned by user';
  END IF;

  -- Insert matches
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
    RETURNING id, event_id
  )
  SELECT count(*) INTO v_inserted_matches FROM inserted;

  -- Compute counters from final state
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
    'pastMatchesCount', v_past_matches
  );
END;
$$;

REVOKE ALL ON FUNCTION public.crm_run_matching(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.crm_run_matching(uuid, uuid) TO service_role;

-- Admin stats RPC
CREATE OR REPLACE FUNCTION public.get_radar_crm_admin_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT jsonb_build_object(
    'totalImports', (SELECT count(*) FROM public.crm_imports),
    'failedImports', (SELECT count(*) FROM public.crm_imports WHERE status = 'failed'),
    'distinctUsers', (SELECT count(DISTINCT user_id) FROM public.crm_imports),
    'totalCompanies', (SELECT count(*) FROM public.crm_companies),
    'totalMatches', (SELECT count(*) FROM public.crm_company_event_matches),
    'avgCompaniesPerImport', (
      SELECT COALESCE(round(avg(total_rows)::numeric, 1), 0)
      FROM public.crm_imports WHERE status = 'completed'
    ),
    'avgMatchRate', (
      SELECT COALESCE(round((avg(
        CASE WHEN total_rows > 0
             THEN matched_companies_count::numeric / total_rows::numeric
             ELSE 0 END
      ) * 100)::numeric, 1), 0)
      FROM public.crm_imports WHERE status = 'completed'
    ),
    'futureMatches', (
      SELECT count(*) FROM public.crm_company_event_matches m
      JOIN public.events e ON e.id = m.event_id
      WHERE e.date_debut >= CURRENT_DATE
    ),
    'pastMatches', (
      SELECT count(*) FROM public.crm_company_event_matches m
      JOIN public.events e ON e.id = m.event_id
      WHERE e.date_debut < CURRENT_DATE
    ),
    'recentImports', (
      SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) FROM (
        SELECT i.id, i.user_id, i.file_name, i.source_type, i.status,
               i.total_rows, i.matched_companies_count, i.unmatched_companies_count,
               i.error_message, i.created_at,
               u.email AS user_email
        FROM public.crm_imports i
        LEFT JOIN auth.users u ON u.id = i.user_id
        ORDER BY i.created_at DESC
        LIMIT 50
      ) t
    )
  ) INTO v;

  RETURN v;
END;
$$;

REVOKE ALL ON FUNCTION public.get_radar_crm_admin_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_radar_crm_admin_stats() TO authenticated;
