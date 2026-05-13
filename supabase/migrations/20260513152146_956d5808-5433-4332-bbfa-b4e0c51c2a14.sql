
-- 1) user_radar_access
CREATE TABLE IF NOT EXISTS public.user_radar_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  access_status text NOT NULL DEFAULT 'beta'
    CHECK (access_status IN ('beta','trial','active','expired','cancelled')),
  trial_started_at timestamptz NULL,
  trial_ends_at timestamptz NULL,
  first_qualified_import_id uuid NULL REFERENCES public.crm_imports(id) ON DELETE SET NULL,
  first_qualified_import_at timestamptz NULL,
  subscribed_at timestamptz NULL,
  stripe_customer_id text NULL,
  stripe_subscription_id text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_radar_access_status ON public.user_radar_access(access_status);

ALTER TABLE public.user_radar_access ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users read own radar access" ON public.user_radar_access;
CREATE POLICY "users read own radar access"
  ON public.user_radar_access FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "admins read all radar access" ON public.user_radar_access;
CREATE POLICY "admins read all radar access"
  ON public.user_radar_access FOR SELECT TO authenticated
  USING (public.is_admin());

DROP TRIGGER IF EXISTS trg_user_radar_access_updated_at ON public.user_radar_access;
CREATE TRIGGER trg_user_radar_access_updated_at
  BEFORE UPDATE ON public.user_radar_access
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) crm_notification_preferences
CREATE TABLE IF NOT EXISTS public.crm_notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  radar_alerts_enabled boolean NOT NULL DEFAULT true,
  trial_teasers_enabled boolean NOT NULL DEFAULT true,
  preferred_alert_timing_days integer NOT NULL DEFAULT 14
    CHECK (preferred_alert_timing_days BETWEEN 7 AND 30),
  max_emails_per_week integer NOT NULL DEFAULT 2
    CHECK (max_emails_per_week BETWEEN 1 AND 5),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.crm_notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users read own crm prefs" ON public.crm_notification_preferences;
CREATE POLICY "users read own crm prefs"
  ON public.crm_notification_preferences FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "users insert own crm prefs" ON public.crm_notification_preferences;
CREATE POLICY "users insert own crm prefs"
  ON public.crm_notification_preferences FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "users update own crm prefs" ON public.crm_notification_preferences;
CREATE POLICY "users update own crm prefs"
  ON public.crm_notification_preferences FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "admins read all crm prefs" ON public.crm_notification_preferences;
CREATE POLICY "admins read all crm prefs"
  ON public.crm_notification_preferences FOR SELECT TO authenticated
  USING (public.is_admin());

DROP TRIGGER IF EXISTS trg_crm_notif_prefs_updated_at ON public.crm_notification_preferences;
CREATE TRIGGER trg_crm_notif_prefs_updated_at
  BEFORE UPDATE ON public.crm_notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) ensure_user_radar_access(_user_id) — service_role only
CREATE OR REPLACE FUNCTION public.ensure_user_radar_access(_user_id uuid)
RETURNS public.user_radar_access
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_row public.user_radar_access;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'user_id required';
  END IF;

  SELECT * INTO v_row FROM public.user_radar_access WHERE user_id = _user_id;
  IF FOUND THEN RETURN v_row; END IF;

  INSERT INTO public.user_radar_access (user_id, access_status)
  VALUES (_user_id, 'beta')
  ON CONFLICT (user_id) DO NOTHING
  RETURNING * INTO v_row;

  IF v_row IS NULL THEN
    SELECT * INTO v_row FROM public.user_radar_access WHERE user_id = _user_id;
  END IF;

  RETURN v_row;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.ensure_user_radar_access(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.ensure_user_radar_access(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.ensure_user_radar_access(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_user_radar_access(uuid) TO service_role;

-- Frontend RPC
CREATE OR REPLACE FUNCTION public.get_or_create_my_radar_access()
RETURNS public.user_radar_access
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_user uuid := auth.uid(); v_row public.user_radar_access;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_row FROM public.user_radar_access WHERE user_id = v_user;
  IF FOUND THEN RETURN v_row; END IF;

  INSERT INTO public.user_radar_access (user_id, access_status)
  VALUES (v_user, 'beta')
  ON CONFLICT (user_id) DO NOTHING
  RETURNING * INTO v_row;

  IF v_row IS NULL THEN
    SELECT * INTO v_row FROM public.user_radar_access WHERE user_id = v_user;
  END IF;

  RETURN v_row;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_or_create_my_radar_access() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_or_create_my_radar_access() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_or_create_my_radar_access() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_or_create_my_crm_notification_preferences()
RETURNS public.crm_notification_preferences
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_user uuid := auth.uid(); v_row public.crm_notification_preferences;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_row FROM public.crm_notification_preferences WHERE user_id = v_user;
  IF FOUND THEN RETURN v_row; END IF;

  INSERT INTO public.crm_notification_preferences (user_id)
  VALUES (v_user)
  ON CONFLICT (user_id) DO NOTHING
  RETURNING * INTO v_row;

  IF v_row IS NULL THEN
    SELECT * INTO v_row FROM public.crm_notification_preferences WHERE user_id = v_user;
  END IF;

  RETURN v_row;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_or_create_my_crm_notification_preferences() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_or_create_my_crm_notification_preferences() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_or_create_my_crm_notification_preferences() TO authenticated;

-- 4) delete_my_radar_crm_data
CREATE OR REPLACE FUNCTION public.delete_my_radar_crm_data()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_imports int := 0; v_companies int := 0; v_matches int := 0; v_alerts int := 0;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT count(*) INTO v_imports FROM public.crm_imports WHERE user_id = v_user;
  SELECT count(*) INTO v_companies FROM public.crm_companies WHERE user_id = v_user;
  SELECT count(*) INTO v_matches FROM public.crm_company_event_matches WHERE user_id = v_user;
  SELECT count(*) INTO v_alerts FROM public.crm_event_alerts WHERE user_id = v_user;

  DELETE FROM public.crm_imports WHERE user_id = v_user;
  DELETE FROM public.crm_event_alerts WHERE user_id = v_user;
  DELETE FROM public.crm_company_event_matches WHERE user_id = v_user;
  DELETE FROM public.crm_companies WHERE user_id = v_user;

  UPDATE public.crm_usage_events
  SET user_id = NULL
  WHERE user_id = v_user
    AND (metadata->>'source' = 'radar_crm' OR event_type LIKE 'crm_%' OR event_type LIKE 'radar_%');

  UPDATE public.crm_notification_preferences
  SET radar_alerts_enabled = true, trial_teasers_enabled = true,
      preferred_alert_timing_days = 14, max_emails_per_week = 2
  WHERE user_id = v_user;

  RETURN jsonb_build_object(
    'success', true,
    'deletedImports', v_imports,
    'deletedCompanies', v_companies,
    'deletedMatches', v_matches,
    'deletedAlerts', v_alerts
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.delete_my_radar_crm_data() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.delete_my_radar_crm_data() FROM anon;
GRANT EXECUTE ON FUNCTION public.delete_my_radar_crm_data() TO authenticated;

-- 5) Admin stats
CREATE OR REPLACE FUNCTION public.get_radar_crm_admin_stats()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_total_imports int; v_failed int; v_distinct_users int;
  v_companies int; v_matches int;
  v_avg_companies numeric; v_avg_match_rate numeric;
  v_future int; v_past int; v_recent jsonb;
  v_beta_users int; v_alerts_enabled int; v_data_deletions int;
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

  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO v_recent FROM (
    SELECT i.id,
      (SELECT email FROM auth.users u WHERE u.id = i.user_id) AS user_email,
      i.file_name, i.source_type, i.status,
      COALESCE(i.total_rows, 0) AS total_rows,
      COALESCE(i.matched_companies_count, 0) AS matched_companies_count,
      COALESCE(i.unmatched_companies_count, 0) AS unmatched_companies_count,
      i.error_message, i.created_at
    FROM public.crm_imports i ORDER BY i.created_at DESC LIMIT 50
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
    'dataDeletions', v_data_deletions
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_radar_crm_admin_stats() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_radar_crm_admin_stats() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_radar_crm_admin_stats() TO authenticated;
