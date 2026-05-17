
-- 1. radar_email_log
CREATE TABLE public.radar_email_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('preview','pending','sent','failed','skipped')),
  dry_run boolean NOT NULL DEFAULT false,
  email_to text,
  email_subject text,
  email_type text NOT NULL DEFAULT 'radar_digest' CHECK (email_type IN ('radar_digest','trial_ending','teaser')),
  visibility_mode text NOT NULL DEFAULT 'full' CHECK (visibility_mode IN ('full','teaser')),
  notification_ids uuid[] NOT NULL DEFAULT '{}',
  event_ids uuid[] NOT NULL DEFAULT '{}',
  import_ids uuid[] NOT NULL DEFAULT '{}',
  events_count integer NOT NULL DEFAULT 0,
  companies_count integer NOT NULL DEFAULT 0,
  scheduled_for timestamptz,
  sent_at timestamptz,
  resend_message_id text,
  error_message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_radar_email_log_user_created ON public.radar_email_log (user_id, created_at DESC);
CREATE INDEX idx_radar_email_log_status_scheduled ON public.radar_email_log (status, scheduled_for);
CREATE INDEX idx_radar_email_log_user_sent ON public.radar_email_log (user_id, sent_at DESC);
CREATE INDEX idx_radar_email_log_notification_ids ON public.radar_email_log USING GIN (notification_ids);

ALTER TABLE public.radar_email_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own radar email logs"
  ON public.radar_email_log FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins read all radar email logs"
  ON public.radar_email_log FOR SELECT TO authenticated
  USING (is_admin());

CREATE POLICY "Service role manages radar email logs"
  ON public.radar_email_log FOR ALL TO public
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE TRIGGER trg_radar_email_log_updated_at
  BEFORE UPDATE ON public.radar_email_log
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. email_unsubscribe_tokens
CREATE TABLE public.email_unsubscribe_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scope text NOT NULL DEFAULT 'radar_crm' CHECK (scope IN ('radar_crm','all')),
  used_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_email_unsubscribe_tokens_user ON public.email_unsubscribe_tokens (user_id);

ALTER TABLE public.email_unsubscribe_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read unsubscribe tokens"
  ON public.email_unsubscribe_tokens FOR SELECT TO authenticated
  USING (is_admin());

CREATE POLICY "Service role manages unsubscribe tokens"
  ON public.email_unsubscribe_tokens FOR ALL TO public
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- 3. Extend crm_notification_preferences
ALTER TABLE public.crm_notification_preferences
  ADD COLUMN IF NOT EXISTS radar_email_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS radar_email_unsubscribed_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_radar_email_sent_at timestamptz;
