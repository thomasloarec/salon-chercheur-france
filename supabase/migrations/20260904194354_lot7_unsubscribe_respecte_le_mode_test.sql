-- ============================================================
-- WF5 — outreach_unsubscribe : garde de mode test.
--
-- Seule modification par rapport a la version du lot 1 : un bloc de
-- sortie anticipee, place APRES la resolution de l'adresse (pour que la
-- resolution reste testable) et AVANT toute ecriture.
-- ============================================================

-- ============================================================
-- Contexte historique (lot 1) : correction du desabonnement activation.
--
-- Avant : un lien "se desinscrire" clique dans un email d'activation
-- resolvait l'adresse depuis organizer_outreach_contacts, c'est-a-dire
-- le contact prospecte par Hunter. Le destinataire reel (le proprietaire
-- du salon) n'etait donc PAS desinscrit, et une tierce personne l'etait
-- a sa place.
--
-- Apres : en sequence 'organizer_activation', l'adresse resolue est
-- celle du proprietaire. La campagne est coupee sur ses DEUX pistes :
-- un organisateur qui dit stop parle pour son entite entiere.
-- ============================================================

CREATE OR REPLACE FUNCTION public.outreach_unsubscribe(
  p_campaign_id uuid,
  p_sequence    text DEFAULT 'unknown'::text,
  p_user_agent  text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_email          text;
  v_company        text;
  v_event_id       uuid;
  v_event_name     text;
  v_event_slug     text;
  v_sequence       text;
  v_is_organizer   boolean := false;
  v_is_activation  boolean := false;
  v_expo_camp      uuid;
  v_orga_camp      uuid;
  v_owner_camp     uuid;
  v_stopped_expo   integer := 0;
  v_stopped_orga   integer := 0;
BEGIN
  v_sequence := CASE
    WHEN p_sequence IN ('claim','novelty','organizer_claim','organizer_activation')
    THEN p_sequence ELSE 'unknown'
  END;

  v_is_organizer  := v_sequence IN ('organizer_claim','organizer_activation');
  v_is_activation := v_sequence = 'organizer_activation';

  -- 0) Piste activation : le destinataire est le PROPRIETAIRE du salon.
  IF v_is_activation THEN
    SELECT r.recipient_email, o.name, s.next_event_id, s.next_event_name,
           s.next_event_slug, oc.id, oc.id
      INTO v_email, v_company, v_event_id, v_event_name,
           v_event_slug, v_orga_camp, v_owner_camp
    FROM public.organizer_outreach_campaigns oc
    JOIN public.organizers o ON o.id = oc.organizer_id
    LEFT JOIN public.v_organizers_summary s ON s.organizer_id = oc.organizer_id
    CROSS JOIN LATERAL public.get_organizer_activation_recipient(oc.id) r
    WHERE oc.id = p_campaign_id
    LIMIT 1;
  END IF;

  -- Resolution de l'adresse. On tente le monde annonce par la sequence,
  -- puis l'autre : un lien mal etiquete ne doit jamais empecher un opt-out.
  IF (v_email IS NULL OR v_email = '') AND v_is_organizer THEN
    SELECT lower(btrim(COALESCE(ct.contact_email, oc.contact_email))),
           o.name, s.next_event_id, s.next_event_name, s.next_event_slug, oc.id
      INTO v_email, v_company, v_event_id, v_event_name, v_event_slug, v_orga_camp
    FROM public.organizer_outreach_campaigns oc
    JOIN public.organizers o ON o.id = oc.organizer_id
    LEFT JOIN public.v_organizers_summary s ON s.organizer_id = oc.organizer_id
    LEFT JOIN public.organizer_outreach_contacts ct
           ON ct.organizer_outreach_campaign_id = oc.id AND ct.is_primary = true
    WHERE oc.id = p_campaign_id
    LIMIT 1;
  END IF;

  IF v_email IS NULL OR v_email = '' THEN
    SELECT lower(btrim(COALESCE(c.contact_email, oc.contact_email))),
           oc.company_name, oc.event_id, e.nom_event, e.slug, oc.id
      INTO v_email, v_company, v_event_id, v_event_name, v_event_slug, v_expo_camp
    FROM public.outreach_campaigns oc
    LEFT JOIN public.events e ON e.id = oc.event_id
    LEFT JOIN public.outreach_contacts c
           ON c.outreach_campaign_id = oc.id AND c.is_primary = true
    WHERE oc.id = p_campaign_id
    LIMIT 1;
  END IF;

  IF (v_email IS NULL OR v_email = '') AND NOT v_is_organizer THEN
    SELECT lower(btrim(COALESCE(ct.contact_email, oc.contact_email))),
           o.name, s.next_event_id, s.next_event_name, s.next_event_slug, oc.id
      INTO v_email, v_company, v_event_id, v_event_name, v_event_slug, v_orga_camp
    FROM public.organizer_outreach_campaigns oc
    JOIN public.organizers o ON o.id = oc.organizer_id
    LEFT JOIN public.v_organizers_summary s ON s.organizer_id = oc.organizer_id
    LEFT JOIN public.organizer_outreach_contacts ct
           ON ct.organizer_outreach_campaign_id = oc.id AND ct.is_primary = true
    WHERE oc.id = p_campaign_id
    LIMIT 1;
  END IF;

  IF v_email IS NULL OR v_email = '' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_email');
  END IF;

  -- MODE TEST : l'adresse a bien ete resolue, la page de confirmation
  -- s'affichera, mais aucune blacklist ni aucun arret de campagne n'est
  -- applique. Sans ce garde, un clic de test desinscrit une vraie
  -- personne qui n'a jamais recu l'email.
  IF public.is_campaign_in_test_mode(p_campaign_id) THEN
    RETURN jsonb_build_object(
      'ok', true, 'simule', true, 'email_resolu', v_email,
      'campaigns_stopped', 0, 'organizer_campaigns_stopped', 0,
      'event_slug', v_event_slug);
  END IF;

  -- 1) Blacklist globale : c'est elle qui protege toutes les vues
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
    email_normalized, campaign_id, organizer_campaign_id, event_id,
    company_name, event_name, sequence_type, user_agent
  )
  VALUES (
    v_email, v_expo_camp, v_orga_camp, v_event_id,
    v_company, v_event_name, v_sequence, left(COALESCE(p_user_agent, ''), 400)
  );

  -- 3) Arret des campagnes exposant portant cette adresse
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
  GET DIAGNOSTICS v_stopped_expo = ROW_COUNT;

  -- 4) Arret des campagnes organisateur : par adresse de contact, ET par
  --    campagne dont le proprietaire est l'auteur du desabonnement.
  UPDATE public.organizer_outreach_campaigns oc
  SET stop_reason           = 'unsubscribe',
      stop_note             = COALESCE(oc.stop_note, 'Désinscription destinataire (lien email)'),
      stopped_at            = COALESCE(oc.stopped_at, now()),
      opt_out               = true,
      claim_status          = 'opted_out',
      activation_status     = CASE WHEN oc.activation_status = 'not_started'
                                   THEN 'not_started' ELSE 'stopped' END,
      activation_stop_reason = COALESCE(oc.activation_stop_reason, 'unsubscribe'),
      activation_stopped_at  = COALESCE(oc.activation_stopped_at, now()),
      activation_next_send_at = NULL,
      updated_at            = now()
  WHERE oc.stop_reason IS DISTINCT FROM 'unsubscribe'
    AND (
      oc.id = v_owner_camp
      OR lower(btrim(oc.contact_email)) = v_email
      OR oc.id IN (
        SELECT ct2.organizer_outreach_campaign_id
        FROM public.organizer_outreach_contacts ct2
        WHERE lower(btrim(ct2.contact_email)) = v_email
      )
    );
  GET DIAGNOSTICS v_stopped_orga = ROW_COUNT;

  RETURN jsonb_build_object(
    'ok', true,
    'campaigns_stopped', v_stopped_expo,
    'organizer_campaigns_stopped', v_stopped_orga,
    'event_slug', v_event_slug
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.outreach_unsubscribe(uuid, text, text) FROM anon;
