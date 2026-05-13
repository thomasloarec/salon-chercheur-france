
ALTER TABLE public.crm_usage_events
  DROP CONSTRAINT IF EXISTS crm_usage_events_user_id_fkey;

ALTER TABLE public.crm_usage_events
  ADD CONSTRAINT crm_usage_events_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
