BEGIN;

-- 1. Nouvelle origine autorisée
ALTER TABLE public.email_blacklist
  DROP CONSTRAINT IF EXISTS email_blacklist_source_check;

ALTER TABLE public.email_blacklist
  ADD CONSTRAINT email_blacklist_source_check
  CHECK (source = ANY (ARRAY[
    'admin_manual',
    'campaign_stop',
    'bounce',
    'hunter',
    'user_request',
    'unsubscribe_link'
  ]));

-- 2. Journal append-only
CREATE TABLE IF NOT EXISTS public.outreach_unsubscribe_events (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_normalized text NOT NULL,
  campaign_id      uuid REFERENCES public.outreach_campaigns(id) ON DELETE SET NULL,
  event_id         uuid REFERENCES public.events(id)             ON DELETE SET NULL,
  company_name     text,
  event_name       text,
  sequence_type    text NOT NULL DEFAULT 'unknown'
                     CHECK (sequence_type IN ('claim', 'novelty', 'unknown')),
  user_agent       text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.outreach_unsubscribe_events TO authenticated;
GRANT ALL ON public.outreach_unsubscribe_events TO service_role;

CREATE INDEX IF NOT EXISTS idx_unsub_events_email
  ON public.outreach_unsubscribe_events (email_normalized);
CREATE INDEX IF NOT EXISTS idx_unsub_events_created
  ON public.outreach_unsubscribe_events (created_at DESC);

ALTER TABLE public.outreach_unsubscribe_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read unsubscribe events"
  ON public.outreach_unsubscribe_events;
CREATE POLICY "Admins can read unsubscribe events"
  ON public.outreach_unsubscribe_events FOR SELECT
  USING (is_admin());

DROP POLICY IF EXISTS "Service role manages unsubscribe events"
  ON public.outreach_unsubscribe_events;
CREATE POLICY "Service role manages unsubscribe events"
  ON public.outreach_unsubscribe_events FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- 3. RPC de désinscription
CREATE OR REPLACE FUNCTION public.outreach_unsubscribe(
  p_campaign_id uuid,
  p_sequence    text DEFAULT 'unknown',
  p_user_agent  text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email      text;
  v_company    text;
  v_event_id   uuid;
  v_event_name text;
  v_event_slug text;
  v_sequence   text;
  v_affected   integer := 0;
BEGIN
  v_sequence := CASE WHEN p_sequence IN ('claim','novelty') THEN p_sequence ELSE 'unknown' END;

  SELECT lower(btrim(COALESCE(c.contact_email, oc.contact_email))),
         oc.company_name,
         oc.event_id,
         e.nom_event,
         e.slug
    INTO v_email, v_company, v_event_id, v_event_name, v_event_slug
  FROM public.outreach_campaigns oc
  LEFT JOIN public.events e
         ON e.id = oc.event_id
  LEFT JOIN public.outreach_contacts c
         ON c.outreach_campaign_id = oc.id
        AND c.is_primary = true
  WHERE oc.id = p_campaign_id
  LIMIT 1;

  IF v_email IS NULL OR v_email = '' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_email');
  END IF;

  -- 1) Blacklist en premier (voir commentaire d'ordre)
  INSERT INTO public.email_blacklist (email_normalized, reason, source, note)
  VALUES (
    v_email,
    'opt_out_global',
    'unsubscribe_link',
    'Désinscription depuis le lien email' || COALESCE(' · ' || v_event_name, '')
  )
  ON CONFLICT (email_normalized) DO UPDATE
    SET source = 'unsubscribe_link',
        reason = 'opt_out_global',
        note   = COALESCE(public.email_blacklist.note, EXCLUDED.note)
    WHERE public.email_blacklist.source <> 'unsubscribe_link';

  -- 2) Journal
  INSERT INTO public.outreach_unsubscribe_events (
    email_normalized, campaign_id, event_id, company_name,
    event_name, sequence_type, user_agent
  )
  VALUES (
    v_email, p_campaign_id, v_event_id, v_company,
    v_event_name, v_sequence, left(COALESCE(p_user_agent, ''), 400)
  );

  -- 3) Arrêt de toutes les campagnes liées à cette adresse
  UPDATE public.outreach_campaigns oc
  SET stop_reason     = 'unsubscribe',
      stop_note       = COALESCE(oc.stop_note, 'Désinscription destinataire (lien email)'),
      stopped_at      = COALESCE(oc.stopped_at, now()),
      campaign_status = 'stopped',
      updated_at      = now()
  WHERE oc.stop_reason IS DISTINCT FROM 'unsubscribe'
    AND (
      lower(btrim(oc.contact_email)) = v_email
      OR oc.id IN (
        SELECT c2.outreach_campaign_id
        FROM public.outreach_contacts c2
        WHERE lower(btrim(c2.contact_email)) = v_email
      )
    );

  GET DIAGNOSTICS v_affected = ROW_COUNT;

  RETURN jsonb_build_object(
    'ok', true,
    'campaigns_stopped', v_affected,
    'event_slug', v_event_slug
  );
END;
$$;

REVOKE ALL ON FUNCTION public.outreach_unsubscribe(uuid, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.outreach_unsubscribe(uuid, text, text)
  TO service_role;

-- 4. Vue admin unifiée
DROP VIEW IF EXISTS public.v_admin_desinscriptions;
CREATE VIEW public.v_admin_desinscriptions
WITH (security_invoker = true) AS
SELECT
  b.email_normalized,
  b.source,
  CASE b.source
    WHEN 'unsubscribe_link' THEN 'Destinataire (lien email)'
    WHEN 'campaign_stop'    THEN 'Arrêt de campagne'
    WHEN 'admin_manual'     THEN 'Ajout manuel admin'
    WHEN 'user_request'     THEN 'Demande reçue par email'
    WHEN 'bounce'           THEN 'Rebond technique'
    WHEN 'hunter'           THEN 'Hunter'
    ELSE b.source
  END                                        AS origine_libelle,
  (b.source = 'unsubscribe_link')            AS auto_desinscrit,
  b.reason,
  b.note,
  b.created_at                               AS blackliste_le,
  u.derniere_desinscription,
  COALESCE(u.nb_clics, 0)                    AS nb_clics,
  u.company_name,
  u.event_name,
  u.sequence_type
FROM public.email_blacklist b
LEFT JOIN LATERAL (
  SELECT
    max(e.created_at)                                            AS derniere_desinscription,
    count(*)                                                     AS nb_clics,
    (array_agg(e.company_name  ORDER BY e.created_at DESC))[1]   AS company_name,
    (array_agg(e.event_name    ORDER BY e.created_at DESC))[1]   AS event_name,
    (array_agg(e.sequence_type ORDER BY e.created_at DESC))[1]   AS sequence_type
  FROM public.outreach_unsubscribe_events e
  WHERE e.email_normalized = b.email_normalized
) u ON true;

-- 5. Protection des désinscriptions volontaires
CREATE OR REPLACE FUNCTION public.protect_unsubscribe_blacklist()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.source = 'unsubscribe_link' THEN
      NEW.source     := 'unsubscribe_link';
      NEW.reason     := OLD.reason;
      NEW.created_at := OLD.created_at;
      NEW.created_by := OLD.created_by;
      NEW.note       := COALESCE(NEW.note, OLD.note);
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF OLD.source = 'unsubscribe_link' THEN
      RAISE EXCEPTION
        'Suppression refusee : % s''est desinscrite elle-meme. Retirer ce blocage relancerait des envois malgre une opposition explicite.',
        OLD.email_normalized
        USING ERRCODE = 'check_violation';
    END IF;
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_unsubscribe_blacklist ON public.email_blacklist;
CREATE TRIGGER trg_protect_unsubscribe_blacklist
BEFORE UPDATE OR DELETE ON public.email_blacklist
FOR EACH ROW
EXECUTE FUNCTION public.protect_unsubscribe_blacklist();

COMMIT;