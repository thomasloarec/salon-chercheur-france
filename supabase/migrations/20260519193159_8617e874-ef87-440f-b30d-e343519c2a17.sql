
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS seo_source_hash text,
  ADD COLUMN IF NOT EXISTS seo_generated_from_hash text,
  ADD COLUMN IF NOT EXISTS seo_generated_at timestamptz,
  ADD COLUMN IF NOT EXISTS seo_last_checked_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_events_seo_generated_from_hash
  ON public.events(seo_generated_from_hash);

CREATE OR REPLACE FUNCTION public.compute_seo_source_hash(p_event_id uuid)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_e record; v_secteur jsonb; v_exhibitors_count int; v_payload jsonb;
BEGIN
  SELECT e.id, e.nom_event, e.slug, e.date_debut, e.date_fin,
         e.ville, e.code_postal, e.nom_lieu, e.pays,
         e.secteur, e.affluence, e.tarif,
         e.description_event, e.meta_description_gen, e.url_site_officiel
    INTO v_e FROM public.events e WHERE e.id = p_event_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  IF jsonb_typeof(v_e.secteur) = 'array' THEN
    SELECT jsonb_agg(value ORDER BY value::text) INTO v_secteur
    FROM jsonb_array_elements(v_e.secteur);
  ELSE
    v_secteur := COALESCE(v_e.secteur, '[]'::jsonb);
  END IF;

  SELECT count(*) INTO v_exhibitors_count
  FROM public.participation p WHERE p.id_event = v_e.id;

  v_payload := jsonb_build_object(
    'nom_event', btrim(coalesce(v_e.nom_event,'')),
    'slug', btrim(coalesce(v_e.slug,'')),
    'date_debut', coalesce(v_e.date_debut::text,''),
    'date_fin', coalesce(v_e.date_fin::text,''),
    'ville', btrim(coalesce(v_e.ville,'')),
    'code_postal', btrim(coalesce(v_e.code_postal,'')),
    'nom_lieu', btrim(coalesce(v_e.nom_lieu,'')),
    'pays', btrim(coalesce(v_e.pays,'')),
    'secteur', COALESCE(v_secteur,'[]'::jsonb),
    'affluence', btrim(coalesce(v_e.affluence,'')),
    'tarif', btrim(coalesce(v_e.tarif,'')),
    'description_event', btrim(coalesce(v_e.description_event,'')),
    'meta_description_gen', btrim(coalesce(v_e.meta_description_gen,'')),
    'url_site_officiel', btrim(coalesce(v_e.url_site_officiel,'')),
    'exhibitors_count', coalesce(v_exhibitors_count, 0)
  );
  RETURN md5(v_payload::text);
END;
$$;
REVOKE ALL ON FUNCTION public.compute_seo_source_hash(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.compute_seo_source_hash(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.seo_eligible_events(p_only_post_import boolean DEFAULT false)
RETURNS TABLE (
  id uuid, nom_event text, slug text, date_debut date,
  enrichissement_score int, enrichissement_statut text,
  description_enrichie_present boolean, enrichissement_ignored boolean,
  current_hash text, generated_from_hash text, status text, reason text
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_last_run_at timestamptz;
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin'::app_role) OR auth.role()='service_role') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF p_only_post_import THEN
    SELECT max(started_at) INTO v_last_run_at FROM public.seo_enrichment_runs
    WHERE status IN ('success','partial');
    IF v_last_run_at IS NULL THEN v_last_run_at := now() - interval '35 days'; END IF;
  END IF;
  RETURN QUERY
  WITH base AS (
    SELECT e.id, e.nom_event, e.slug, e.date_debut,
           e.enrichissement_score, e.enrichissement_statut,
           e.description_enrichie, e.enrichissement_ignored,
           e.seo_generated_from_hash,
           public.compute_seo_source_hash(e.id) AS current_hash,
           e.updated_at, e.created_at
    FROM public.events e
    WHERE e.visible=true
      AND coalesce(e.is_test,false)=false
      AND coalesce(e.enrichissement_ignored,false)=false
      AND e.slug IS NOT NULL AND e.slug<>''
      AND e.date_debut >= CURRENT_DATE
      AND coalesce(e.enrichissement_score,0) >= 55
      AND (NOT p_only_post_import OR e.updated_at >= v_last_run_at OR e.created_at >= v_last_run_at)
  )
  SELECT b.id, b.nom_event, b.slug, b.date_debut,
    b.enrichissement_score, b.enrichissement_statut,
    (b.description_enrichie IS NOT NULL AND length(btrim(b.description_enrichie))>0),
    coalesce(b.enrichissement_ignored,false),
    b.current_hash, b.seo_generated_from_hash,
    CASE WHEN b.description_enrichie IS NOT NULL
              AND length(btrim(b.description_enrichie))>0
              AND b.enrichissement_statut='valide'
              AND b.seo_generated_from_hash=b.current_hash
         THEN 'up_to_date' ELSE 'needs_claude' END,
    CASE
      WHEN b.description_enrichie IS NULL OR length(btrim(b.description_enrichie))=0
        THEN 'description_enrichie absente'
      WHEN coalesce(b.enrichissement_statut,'')<>'valide'
        THEN 'enrichissement_statut <> valide ('||coalesce(b.enrichissement_statut,'null')||')'
      WHEN b.seo_generated_from_hash IS NULL THEN 'hash jamais enregistré'
      WHEN b.seo_generated_from_hash<>b.current_hash THEN 'source modifiée depuis dernière génération'
      ELSE NULL END
  FROM base b;
END;
$$;
REVOKE ALL ON FUNCTION public.seo_eligible_events(boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.seo_eligible_events(boolean) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.check_seo_automation_dependencies()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions, vault AS $$
DECLARE
  v_has_secret boolean := false; v_has_anon boolean := false;
  v_has_logs boolean := false; v_has_pg_net boolean := false;
  v_running int := 0; v_cron_tbl boolean;
  v_job_exists boolean := false; v_job_active boolean := false;
  v_job_name text := NULL; v_job_schedule text := NULL;
  v_would_call int := 0; v_would_skip int := 0;
  v_ignored int := 0; v_score_lt_55 int := 0; v_score_null int := 0;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin'::app_role) THEN
    RAISE EXCEPTION 'admin only';
  END IF;

  SELECT EXISTS(SELECT 1 FROM vault.decrypted_secrets WHERE name='SEO_BATCH_SECRET' AND length(decrypted_secret)>0) INTO v_has_secret;
  SELECT EXISTS(SELECT 1 FROM vault.decrypted_secrets WHERE name='SUPABASE_ANON_KEY' AND length(decrypted_secret)>0) INTO v_has_anon;
  SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='application_logs') INTO v_has_logs;
  SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname='pg_net') INTO v_has_pg_net;
  SELECT count(*) INTO v_running FROM public.seo_enrichment_runs
   WHERE status='running' AND started_at > now() - interval '2 hours';

  v_cron_tbl := to_regclass('cron.job') IS NOT NULL;
  IF v_cron_tbl THEN
    BEGIN
      EXECUTE $sql$
        SELECT true, active, jobname, schedule FROM cron.job
        WHERE jobname IN ('seo-enrichment-nightly','seo-enrichment-weekly-catchup') LIMIT 1
      $sql$ INTO v_job_exists, v_job_active, v_job_name, v_job_schedule;
    EXCEPTION WHEN OTHERS THEN v_job_exists := false; END;
  END IF;

  SELECT count(*) FILTER (WHERE status='needs_claude'),
         count(*) FILTER (WHERE status='up_to_date')
  INTO v_would_call, v_would_skip FROM public.seo_eligible_events(false);

  SELECT count(*) INTO v_ignored FROM public.events
   WHERE visible=true AND coalesce(is_test,false)=false
     AND coalesce(enrichissement_ignored,false)=true
     AND slug IS NOT NULL AND slug<>'' AND date_debut>=CURRENT_DATE;

  SELECT count(*) FILTER (WHERE enrichissement_score IS NOT NULL AND enrichissement_score<55),
         count(*) FILTER (WHERE enrichissement_score IS NULL)
  INTO v_score_lt_55, v_score_null FROM public.events
   WHERE visible=true AND coalesce(is_test,false)=false
     AND coalesce(enrichissement_ignored,false)=false
     AND slug IS NOT NULL AND slug<>'' AND date_debut>=CURRENT_DATE;

  RETURN jsonb_build_object(
    'all_ok', v_has_secret AND v_has_anon AND v_has_logs AND v_has_pg_net AND v_running=0,
    'has_seo_batch_secret', v_has_secret, 'has_anon_key', v_has_anon,
    'application_logs_exists', v_has_logs, 'pg_net_installed', v_has_pg_net,
    'running_run_in_last_2h', v_running,
    'cron_job_exists', coalesce(v_job_exists,false),
    'cron_job_name', v_job_name,
    'cron_job_active', coalesce(v_job_active,false),
    'cron_job_schedule', v_job_schedule,
    'would_call_claude_count', v_would_call,
    'would_skip_count', v_would_skip,
    'ignored_count', v_ignored,
    'score_lt_55_count', v_score_lt_55,
    'score_null_count', v_score_null);
END;
$$;
REVOKE ALL ON FUNCTION public.check_seo_automation_dependencies() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_seo_automation_dependencies() TO authenticated;

CREATE OR REPLACE FUNCTION public.check_seo_cron_dependencies()
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$ SELECT public.check_seo_automation_dependencies(); $$;
REVOKE ALL ON FUNCTION public.check_seo_cron_dependencies() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_seo_cron_dependencies() TO authenticated;

CREATE OR REPLACE FUNCTION public.start_seo_weekly_catchup()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions, vault AS $$
DECLARE v_running int; v_secret text; v_anon text; v_base_url text; v_url text; v_request_id bigint;
BEGIN
  SELECT count(*) INTO v_running FROM public.seo_enrichment_runs
   WHERE status='running' AND started_at > now() - interval '2 hours';
  IF v_running>0 THEN
    INSERT INTO public.application_logs(level,source,message,details)
    VALUES('warn','seo-weekly','Skipped: run already in progress',jsonb_build_object('running_count',v_running));
    RETURN jsonb_build_object('skipped',true,'reason','run_in_progress');
  END IF;
  SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets WHERE name='SEO_BATCH_SECRET' LIMIT 1;
  IF v_secret IS NULL OR length(v_secret)=0 THEN
    INSERT INTO public.application_logs(level,source,message) VALUES('error','seo-weekly','SEO_BATCH_SECRET not found');
    RETURN jsonb_build_object('skipped',true,'reason','missing_secret');
  END IF;
  SELECT decrypted_secret INTO v_anon FROM vault.decrypted_secrets WHERE name='SUPABASE_ANON_KEY' LIMIT 1;
  IF v_anon IS NULL OR length(v_anon)=0 THEN
    INSERT INTO public.application_logs(level,source,message) VALUES('error','seo-weekly','SUPABASE_ANON_KEY not found');
    RETURN jsonb_build_object('skipped',true,'reason','missing_anon_key');
  END IF;
  SELECT decrypted_secret INTO v_base_url FROM vault.decrypted_secrets
   WHERE name IN ('SUPABASE_FUNCTIONS_URL','SUPABASE_URL')
   ORDER BY CASE name WHEN 'SUPABASE_FUNCTIONS_URL' THEN 0 ELSE 1 END LIMIT 1;
  IF v_base_url IS NULL OR length(v_base_url)=0 THEN
    v_base_url := 'https://vxivdvzzhebobveedxbj.supabase.co';
  END IF;
  v_url := rtrim(v_base_url,'/');
  IF v_url NOT LIKE '%/functions/v1' THEN v_url := v_url || '/functions/v1'; END IF;
  v_url := v_url || '/seo-enrichment-batch';
  SELECT net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type','application/json','apikey',v_anon,
      'Authorization','Bearer '||v_anon,'x-seo-batch-secret',v_secret),
    body := jsonb_build_object('mode','run','limit',20,'deploy',true,'trigger_source','weekly_cron')
  ) INTO v_request_id;
  INSERT INTO public.application_logs(level,source,message,details)
  VALUES('info','seo-weekly','Weekly catchup triggered',jsonb_build_object('request_id',v_request_id,'url',v_url));
  RETURN jsonb_build_object('triggered',true,'request_id',v_request_id);
END;
$$;
REVOKE ALL ON FUNCTION public.start_seo_weekly_catchup() FROM PUBLIC, anon, authenticated;

-- Backfill idempotent
UPDATE public.events e
SET seo_source_hash = public.compute_seo_source_hash(e.id),
    seo_generated_from_hash = public.compute_seo_source_hash(e.id),
    seo_generated_at = COALESCE(e.auto_validated_at, e.updated_at, now()),
    seo_last_checked_at = now()
WHERE e.visible = true
  AND coalesce(e.is_test,false) = false
  AND e.description_enrichie IS NOT NULL
  AND length(btrim(e.description_enrichie)) > 0
  AND e.enrichissement_statut = 'valide'
  AND e.seo_generated_from_hash IS NULL;
