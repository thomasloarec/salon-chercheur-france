
CREATE TABLE IF NOT EXISTS public.seo_enrichment_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL DEFAULT 'running',
  trigger_source text NOT NULL DEFAULT 'cron',
  events_selected integer NOT NULL DEFAULT 0,
  events_processed integer NOT NULL DEFAULT 0,
  events_success integer NOT NULL DEFAULT 0,
  events_failed integer NOT NULL DEFAULT 0,
  events_skipped integer NOT NULL DEFAULT 0,
  meta_done integer NOT NULL DEFAULT 0,
  description_done integer NOT NULL DEFAULT 0,
  deploy_hook_triggered boolean NOT NULL DEFAULT false,
  deploy_hook_status integer,
  deploy_hook_error text,
  error_message text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT seo_enrichment_runs_status_chk
    CHECK (status IN ('running','success','partial','failed')),
  CONSTRAINT seo_enrichment_runs_trigger_source_chk
    CHECK (trigger_source IN ('cron','manual','dry_run'))
);

CREATE INDEX IF NOT EXISTS idx_seo_enrichment_runs_started_at
  ON public.seo_enrichment_runs (started_at DESC);

ALTER TABLE public.seo_enrichment_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read seo runs" ON public.seo_enrichment_runs;
CREATE POLICY "Admins read seo runs" ON public.seo_enrichment_runs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Service role manages seo runs" ON public.seo_enrichment_runs;
CREATE POLICY "Service role manages seo runs" ON public.seo_enrichment_runs
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP VIEW IF EXISTS public.v_seo_enrichment_status;
CREATE VIEW public.v_seo_enrichment_status
WITH (security_invoker = true) AS
SELECT
  (SELECT row_to_json(r) FROM (
    SELECT id, started_at, finished_at, status, trigger_source,
           events_selected, events_processed, events_success, events_failed, events_skipped,
           meta_done, description_done,
           deploy_hook_triggered, deploy_hook_status, deploy_hook_error, error_message
    FROM public.seo_enrichment_runs
    ORDER BY started_at DESC LIMIT 1
  ) r) AS last_run,
  (SELECT COUNT(*) FROM public.seo_enrichment_runs
     WHERE started_at > now() - interval '7 days') AS runs_last_7d,
  (SELECT COALESCE(SUM(events_success),0) FROM public.seo_enrichment_runs
     WHERE started_at > now() - interval '7 days') AS success_last_7d,
  (SELECT COALESCE(SUM(events_failed),0) FROM public.seo_enrichment_runs
     WHERE started_at > now() - interval '7 days') AS failed_last_7d;

GRANT SELECT ON public.v_seo_enrichment_status TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.count_seo_enrichment_eligible()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total int;
  v_no_meta int;
  v_not_valid int;
  v_no_desc int;
  v_short_desc int;
BEGIN
  IF auth.role() <> 'service_role'
     AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT count(*) INTO v_no_meta FROM public.events
   WHERE visible = true
     AND coalesce(is_test, false) = false
     AND slug IS NOT NULL AND slug <> ''
     AND date_debut >= CURRENT_DATE
     AND meta_description_gen IS NULL;

  SELECT count(*) INTO v_not_valid FROM public.events
   WHERE visible = true
     AND coalesce(is_test, false) = false
     AND slug IS NOT NULL AND slug <> ''
     AND date_debut >= CURRENT_DATE
     AND (enrichissement_statut IS NULL OR enrichissement_statut <> 'valide');

  SELECT count(*) INTO v_no_desc FROM public.events
   WHERE visible = true
     AND coalesce(is_test, false) = false
     AND slug IS NOT NULL AND slug <> ''
     AND date_debut >= CURRENT_DATE
     AND description_enrichie IS NULL;

  SELECT count(*) INTO v_short_desc FROM public.events
   WHERE visible = true
     AND coalesce(is_test, false) = false
     AND slug IS NOT NULL AND slug <> ''
     AND date_debut >= CURRENT_DATE
     AND char_length(coalesce(description_event,'')) < 500;

  SELECT count(*) INTO v_total FROM public.events
   WHERE visible = true
     AND coalesce(is_test, false) = false
     AND slug IS NOT NULL AND slug <> ''
     AND date_debut >= CURRENT_DATE
     AND (
       meta_description_gen IS NULL
       OR enrichissement_statut IS NULL OR enrichissement_statut <> 'valide'
       OR description_enrichie IS NULL
       OR char_length(coalesce(description_event,'')) < 500
     );

  RETURN jsonb_build_object(
    'total_eligible', v_total,
    'no_meta', v_no_meta,
    'not_valide_status', v_not_valid,
    'no_description_enrichie', v_no_desc,
    'short_description', v_short_desc
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.count_seo_enrichment_eligible()
  TO authenticated, service_role;
