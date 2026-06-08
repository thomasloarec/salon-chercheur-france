CREATE OR REPLACE FUNCTION public.expire_past_campaigns()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.outreach_campaigns oc
  SET campaign_status = 'expired',
      stop_reason = COALESCE(oc.stop_reason, 'event_passed'),
      stop_note = COALESCE(oc.stop_note, 'expired_from:' || oc.campaign_status),
      next_send_at = NULL,
      updated_at = now()
  WHERE oc.campaign_status IN ('active', 'not_started')
    AND oc.event_id IN (
      SELECT id FROM public.events WHERE date_debut < CURRENT_DATE
    );

  GET DIAGNOSTICS v_count = ROW_COUNT;

  INSERT INTO public.application_logs (level, message, details, source, function_name)
  VALUES (
    'info',
    'expire_past_campaigns: ' || v_count || ' campaign(s) expired',
    jsonb_build_object('expired_count', v_count, 'ran_at', now()),
    'pg_cron',
    'expire_past_campaigns'
  );

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.expire_past_campaigns() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_past_campaigns() TO service_role;

SELECT cron.schedule(
  'expire-past-campaigns-daily',
  '30 3 * * *',
  $$ SELECT public.expire_past_campaigns(); $$
);