ALTER TABLE public.crm_notification_preferences
  ADD COLUMN IF NOT EXISTS radar_email_disabled_at timestamptz NULL;

UPDATE public.crm_notification_preferences p
SET radar_email_enabled = true,
    updated_at = now()
WHERE p.radar_email_enabled = false
  AND p.radar_email_unsubscribed_at IS NULL
  AND p.radar_email_disabled_at IS NULL
  AND EXISTS (
    SELECT 1 FROM public.crm_imports i
    WHERE i.user_id = p.user_id
      AND i.status = 'completed'
  );

INSERT INTO public.crm_notification_preferences (user_id, radar_alerts_enabled, radar_email_enabled)
SELECT DISTINCT i.user_id, true, true
FROM public.crm_imports i
WHERE i.status = 'completed'
ON CONFLICT (user_id) DO NOTHING;