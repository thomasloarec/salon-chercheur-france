
-- 1. Colonnes de suivi d'arrêt manuel
ALTER TABLE public.outreach_campaigns
  ADD COLUMN IF NOT EXISTS stop_note  text,
  ADD COLUMN IF NOT EXISTS stopped_at timestamptz,
  ADD COLUMN IF NOT EXISTS stopped_by uuid;

-- 2. Table email_blacklist
CREATE TABLE IF NOT EXISTS public.email_blacklist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_normalized text NOT NULL UNIQUE,
  reason text NOT NULL CHECK (reason IN ('invalid_address','opt_out_global','manual','bounce')),
  source text NOT NULL DEFAULT 'admin_manual'
    CHECK (source IN ('admin_manual','campaign_stop','bounce','hunter','user_request')),
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_blacklist_email
  ON public.email_blacklist(email_normalized);

-- 3. Trigger normalisation email
CREATE OR REPLACE FUNCTION public.normalize_blacklist_email()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.email_normalized := lower(btrim(NEW.email_normalized));
  IF NEW.email_normalized IS NULL OR NEW.email_normalized = '' THEN
    RAISE EXCEPTION 'email_normalized cannot be empty';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_normalize_blacklist_email ON public.email_blacklist;
CREATE TRIGGER trg_normalize_blacklist_email
  BEFORE INSERT OR UPDATE ON public.email_blacklist
  FOR EACH ROW EXECUTE FUNCTION public.normalize_blacklist_email();

-- 4. Helper is_email_blacklisted
CREATE OR REPLACE FUNCTION public.is_email_blacklisted(_email text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.email_blacklist
    WHERE email_normalized = lower(btrim(_email))
  );
$$;

-- 5. Trigger auto-blacklist sur arrêt terminal
CREATE OR REPLACE FUNCTION public.auto_blacklist_on_campaign_stop()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.contact_email IS NOT NULL
     AND NEW.contact_email <> ''
     AND NEW.stop_reason IN ('email_not_found','do_not_contact')
     AND (TG_OP = 'INSERT' OR OLD.stop_reason IS DISTINCT FROM NEW.stop_reason)
  THEN
    INSERT INTO public.email_blacklist (email_normalized, reason, source, note, created_by)
    VALUES (
      lower(btrim(NEW.contact_email)),
      CASE WHEN NEW.stop_reason = 'email_not_found'
           THEN 'invalid_address'
           ELSE 'opt_out_global'
      END,
      'campaign_stop',
      NEW.stop_note,
      NEW.stopped_by
    )
    ON CONFLICT (email_normalized) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_blacklist_on_stop ON public.outreach_campaigns;
CREATE TRIGGER trg_auto_blacklist_on_stop
  AFTER INSERT OR UPDATE OF stop_reason ON public.outreach_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.auto_blacklist_on_campaign_stop();

-- 6. RLS email_blacklist
ALTER TABLE public.email_blacklist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage email blacklist" ON public.email_blacklist;
CREATE POLICY "Admins can manage email blacklist"
  ON public.email_blacklist
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Service role manages email blacklist" ON public.email_blacklist;
CREATE POLICY "Service role manages email blacklist"
  ON public.email_blacklist
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- 7. Mise à jour v_exposants_eligibles
CREATE OR REPLACE VIEW public.v_exposants_eligibles AS
SELECT
  oc.id,
  oc.event_id,
  oc.company_name,
  oc.website,
  oc.current_step,
  oc.next_send_at,
  oc.campaign_status,
  oc.claude_classification,
  e.nom_event,
  e.slug AS event_slug,
  (e.date_debut - CURRENT_DATE) AS days_before_event,
  c.contact_email,
  c.first_name,
  c.last_name,
  c.job_title,
  (SELECT count(*) FROM novelties n
    WHERE n.event_id = oc.event_id
      AND n.status = 'published'
      AND n.is_test = false) AS novelties_count
FROM outreach_campaigns oc
JOIN events e ON e.id = oc.event_id
LEFT JOIN outreach_contacts c
  ON c.outreach_campaign_id = oc.id AND c.is_primary = true
WHERE oc.hunter_status = 'ready'
  AND oc.claude_classification = ANY (ARRAY['PME','INCERTAIN'])
  AND oc.campaign_status <> ALL (ARRAY[
    'converted','opted_out','completed',
    'stopped','blocked_invalid_email','novelty_published'
  ])
  AND oc.current_step < 3
  AND oc.opt_out = false
  AND oc.stop_reason IS NULL
  AND c.contact_email IS NOT NULL
  AND NOT public.is_email_blacklisted(c.contact_email)
  AND ((oc.next_send_at IS NULL) OR (oc.next_send_at <= now()))
  AND e.visible = true
  AND e.is_test = false
  AND (e.date_debut - CURRENT_DATE) >= 3
  AND (e.date_debut - CURRENT_DATE) <= 50
  AND NOT EXISTS (
    SELECT 1 FROM novelties n2
    WHERE n2.exhibitor_id = oc.exhibitor_id
      AND n2.status = 'published'
      AND n2.is_test = false
  );
