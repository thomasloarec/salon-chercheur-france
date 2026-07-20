-- 1) Helper RPC to fetch events missing an accroche
CREATE OR REPLACE FUNCTION public.select_events_missing_accroche(p_limit integer DEFAULT 100)
RETURNS TABLE (
  id uuid,
  nom_event text,
  ville text,
  secteur jsonb,
  description_event text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT e.id, e.nom_event, e.ville, e.secteur, e.description_event
  FROM public.events e
  WHERE e.visible = true
    AND e.is_test = false
    AND NOT EXISTS (
      SELECT 1 FROM public.event_ai a
      WHERE a.event_id = e.id AND a.accroche IS NOT NULL
    )
  ORDER BY e.date_debut NULLS LAST
  LIMIT GREATEST(1, LEAST(p_limit, 500));
$$;

REVOKE ALL ON FUNCTION public.select_events_missing_accroche(integer) FROM public;
GRANT EXECUTE ON FUNCTION public.select_events_missing_accroche(integer) TO service_role;

-- 2) Schedule the edge function via pg_cron + pg_net (mirrors radar-crm crons)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'generate-event-accroches-daily') THEN
    PERFORM cron.unschedule('generate-event-accroches-daily');
  END IF;
END $$;

SELECT cron.schedule(
  'generate-event-accroches-daily',
  '42 3 * * *',
  $cmd$
  select net.http_post(
    url := 'https://vxivdvzzhebobveedxbj.supabase.co/functions/v1/generate-event-accroches',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'SERVICE_ROLE_KEY'
        limit 1
      )
    ),
    body := jsonb_build_object()
  );
  $cmd$
);