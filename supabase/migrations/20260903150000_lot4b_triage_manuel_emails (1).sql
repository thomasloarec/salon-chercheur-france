-- ============================================================================
-- LOT 4b — Traitement manuel des emails organisateurs
--   - saisie manuelle d'un email (portée organisateur, source=manual)
--   - classement "pas d'email" (portée salon)
--   - vue + compteur pour la notification et le filtre admin
--
-- Appliquée en production le 2026-09-03 via Supabase MCP.
-- Migration enregistrée : lot4b_triage_manuel_emails_organisateurs
--
-- Décisions actées :
--  - Saisie d'un email depuis une fiche salon = contact de l'ORGANISATEUR
--    (une seule campagne par organisateur), donc résout tous ses salons.
--  - Classement "pas d'email" = portée SALON uniquement.
--  - Email manuel accepté tel quel, sans vérification Hunter.
--  - Pas de cache Hunter : chaque domaine est interrogé au plus une fois par
--    construction (pending -> ready/manual_review, jamais de retry, domaine
--    unique par organisateur).
--
-- Vérifié : saisie email résout tous les salons d'un organisateur d'un coup ;
-- "pas d'email" retire exactement un salon ; zéro grant anon.
-- ============================================================================

-- 1. Triage par salon
CREATE TABLE IF NOT EXISTS public.organizer_salon_triage (
  event_id      uuid PRIMARY KEY REFERENCES public.events(id) ON DELETE CASCADE,
  triage_status text NOT NULL DEFAULT 'no_email'
    CHECK (triage_status IN ('no_email')),
  note          text,
  reviewed_by   uuid,
  reviewed_at   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.organizer_salon_triage IS
  'Salons revus manuellement et classes "pas d email". Portee salon, pas organisateur.';

ALTER TABLE public.organizer_salon_triage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage salon triage" ON public.organizer_salon_triage;
CREATE POLICY "Admins manage salon triage" ON public.organizer_salon_triage
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "service_role salon triage" ON public.organizer_salon_triage;
CREATE POLICY "service_role salon triage" ON public.organizer_salon_triage
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 2. Vue des salons dont l'organisateur n'a pas de contact et non classes
CREATE OR REPLACE VIEW public.v_admin_salons_email_missing
WITH (security_invoker = on, security_barrier = on) AS
SELECT
  e.id            AS event_id,
  e.nom_event,
  e.date_debut,
  e.url_site_officiel_domain AS domain,
  o.id            AS organizer_id,
  o.name          AS organizer_name,
  c.id            AS campaign_id
FROM events e
JOIN organizer_domains od ON od.domain = e.url_site_officiel_domain
JOIN organizers o        ON o.id = od.organizer_id
JOIN organizer_outreach_campaigns c ON c.organizer_id = o.id
LEFT JOIN organizer_salon_triage t ON t.event_id = e.id
WHERE e.visible = true
  AND COALESCE(e.is_test,false) = false
  AND e.date_debut >= CURRENT_DATE
  AND c.hunter_status = 'manual_review'
  AND o.outreach_blocked = false
  AND t.event_id IS NULL;

-- 3. Compteur notification
CREATE OR REPLACE FUNCTION public.admin_count_salons_email_missing()
RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT CASE WHEN public.is_admin()
    THEN (SELECT count(*)::int FROM public.v_admin_salons_email_missing)
    ELSE 0 END;
$function$;

-- 4. Saisie manuelle d'un email : PORTEE ORGANISATEUR
CREATE OR REPLACE FUNCTION public.admin_set_salon_manual_email(
  p_event_id uuid,
  p_email    text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_campaign_id  uuid;
  v_organizer_id uuid;
  v_email        text := lower(btrim(p_email));
  v_salons       integer := 0;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF v_email = '' OR v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_email');
  END IF;

  SELECT c.id, o.id INTO v_campaign_id, v_organizer_id
  FROM events e
  JOIN organizer_domains od ON od.domain = e.url_site_officiel_domain
  JOIN organizers o ON o.id = od.organizer_id
  JOIN organizer_outreach_campaigns c ON c.organizer_id = o.id
  WHERE e.id = p_event_id
  LIMIT 1;

  IF v_campaign_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_campaign');
  END IF;

  DELETE FROM organizer_outreach_contacts
  WHERE organizer_outreach_campaign_id = v_campaign_id;

  INSERT INTO organizer_outreach_contacts (
    organizer_outreach_campaign_id, contact_email,
    tier, tier_rank, source, is_primary, contact_status
  )
  VALUES (
    v_campaign_id, v_email,
    'autre', 0, 'manual', true, 'ready'
  );

  UPDATE organizer_outreach_campaigns
  SET hunter_status = 'ready',
      contact_email = v_email
  WHERE id = v_campaign_id;

  SELECT COALESCE(nb_salons_a_venir, 0) INTO v_salons
  FROM v_organizers_summary WHERE organizer_id = v_organizer_id;

  RETURN jsonb_build_object(
    'ok', true,
    'organizer_id', v_organizer_id,
    'salons_resolus', v_salons
  );
END;
$function$;

-- 5. Classer un salon "pas d'email" : PORTEE SALON
CREATE OR REPLACE FUNCTION public.admin_set_salon_no_email(
  p_event_id uuid,
  p_note     text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  INSERT INTO organizer_salon_triage (event_id, triage_status, note, reviewed_by, reviewed_at)
  VALUES (p_event_id, 'no_email', NULLIF(btrim(p_note),''), auth.uid(), now())
  ON CONFLICT (event_id) DO UPDATE
    SET triage_status = 'no_email',
        note = COALESCE(NULLIF(btrim(EXCLUDED.note),''), organizer_salon_triage.note),
        reviewed_by = auth.uid(),
        reviewed_at = now();

  RETURN jsonb_build_object('ok', true, 'event_id', p_event_id);
END;
$function$;

-- 6. Annuler un classement "pas d'email"
CREATE OR REPLACE FUNCTION public.admin_clear_salon_triage(p_event_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  DELETE FROM organizer_salon_triage WHERE event_id = p_event_id;
  RETURN jsonb_build_object('ok', true, 'event_id', p_event_id);
END;
$function$;

-- 7. Droits
REVOKE ALL ON FUNCTION public.admin_count_salons_email_missing() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_set_salon_manual_email(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_set_salon_no_email(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_clear_salon_triage(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.admin_count_salons_email_missing() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_set_salon_manual_email(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_set_salon_no_email(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_clear_salon_triage(uuid) TO authenticated, service_role;

-- ============================================================================
-- 8. Complément : enrichir l'état renvoyé à la fiche salon
--    Ajoute hunter_status, contact_email et salon_no_email pour que le front
--    sache s'il doit proposer la saisie manuelle / le classement "pas d'email".
--    (Migration : lot4b_ajout_hunter_status_dans_outreach_state)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_event_organizer_outreach_state(p_event_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT jsonb_build_object(
    'organizer_id',       o.id,
    'organizer_name',     o.name,
    'primary_domain',     o.primary_domain,
    'outreach_blocked',   o.outreach_blocked,
    'blocked_reason',     o.blocked_reason,
    'blocked_at',         o.blocked_at,
    'nb_salons_total',    COALESCE(s.nb_salons_total, 0),
    'nb_salons_a_venir',  COALESCE(s.nb_salons_a_venir, 0),
    'campaign_id',        c.id,
    'hunter_status',      c.hunter_status,
    'claim_status',       c.claim_status,
    'claim_step',         c.claim_step,
    'last_sent_at',       c.last_sent_at,
    'next_send_at',       c.next_send_at,
    'stop_reason',        c.stop_reason,
    'contact_email',      c.contact_email,
    'has_contact',        (c.id IS NOT NULL AND EXISTS (
                             SELECT 1 FROM organizer_outreach_contacts ct
                             WHERE ct.organizer_outreach_campaign_id = c.id)),
    'salon_no_email',     EXISTS (
                             SELECT 1 FROM organizer_salon_triage t
                             WHERE t.event_id = p_event_id AND t.triage_status = 'no_email')
  )
  INTO v
  FROM events e
  JOIN organizer_domains od ON od.domain = e.url_site_officiel_domain
  JOIN organizers o ON o.id = od.organizer_id
  LEFT JOIN v_organizers_summary s ON s.organizer_id = o.id
  LEFT JOIN organizer_outreach_campaigns c ON c.organizer_id = o.id
  WHERE e.id = p_event_id
  LIMIT 1;

  RETURN COALESCE(v, jsonb_build_object('organizer_id', NULL));
END;
$function$;
