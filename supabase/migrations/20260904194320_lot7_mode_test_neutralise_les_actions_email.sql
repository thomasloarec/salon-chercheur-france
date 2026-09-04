-- ============================================================
-- WF5 — Le mode test doit aussi neutraliser les ACTIONS, pas seulement
-- rediriger les envois.
--
-- Incident du 04/09/2026 : un email de test, redirige vers une boite
-- interne, contenait des liens portant l'identifiant de la campagne
-- reelle. Un clic sur "se desinscrire" a donc desinscrit un vrai
-- organisateur qui n'avait jamais recu l'email.
--
-- Correction : tant que le mode test est actif ET que la campagne visee
-- est celle designee pour le test, les fonctions declenchees depuis un
-- email n'appliquent aucun effet. Elles retournent un succes simule pour
-- que la page de confirmation reste testable.
--
-- La protection est placee en base, au meme endroit que la vue, plutot
-- que dans les Edge Functions : elle couvre ainsi tous les appelants.
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_campaign_in_test_mode(p_campaign_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT tm.enabled
       AND (tm.only_campaign_id IS NULL OR tm.only_campaign_id = p_campaign_id)
     FROM public.outreach_test_mode tm WHERE tm.id = true),
    false);
$$;

REVOKE ALL ON FUNCTION public.is_campaign_in_test_mode(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.is_campaign_in_test_mode(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.is_campaign_in_test_mode(uuid) TO service_role;

-- ------------------------------------------------------------
-- Garde en tete de organizer_activation_feedback_record.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.organizer_activation_feedback_record(
  p_campaign_id uuid,
  p_choix       text,
  p_theme       text DEFAULT NULL,
  p_user_agent  text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org  uuid;
  v_step integer;
BEGIN
  IF p_choix NOT IN ('pas_le_temps','pas_le_bon_contact','donnees_indispo','pas_interesse','aidez_moi') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'choix_invalide');
  END IF;

  SELECT organizer_id, activation_step INTO v_org, v_step
  FROM public.organizer_outreach_campaigns WHERE id = p_campaign_id;

  IF v_org IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'campagne_inconnue');
  END IF;

  -- MODE TEST : la page de confirmation s'affiche, rien n'est ecrit.
  IF public.is_campaign_in_test_mode(p_campaign_id) THEN
    RETURN jsonb_build_object('ok', true, 'choix', p_choix, 'simule', true);
  END IF;

  INSERT INTO public.organizer_activation_feedback
    (campaign_id, organizer_id, choix, theme, activation_step, user_agent)
  VALUES
    (p_campaign_id, v_org, p_choix, p_theme, v_step, left(COALESCE(p_user_agent, ''), 400));

  IF p_choix = 'pas_interesse' THEN
    UPDATE public.organizer_outreach_campaigns
    SET activation_status      = 'stopped',
        activation_stop_reason = 'feedback_pas_interesse',
        activation_stopped_at  = now(),
        activation_next_send_at = NULL,
        updated_at             = now()
    WHERE id = p_campaign_id;

  ELSIF p_choix IN ('pas_le_bon_contact','aidez_moi') THEN
    UPDATE public.organizer_outreach_campaigns
    SET activation_status      = 'stopped',
        activation_stop_reason = 'feedback_' || p_choix,
        activation_stopped_at  = now(),
        activation_next_send_at = NULL,
        updated_at             = now()
    WHERE id = p_campaign_id;

  ELSIF p_choix IN ('pas_le_temps','donnees_indispo') THEN
    UPDATE public.organizer_outreach_campaigns
    SET activation_next_send_at = now() + interval '30 days',
        updated_at              = now()
    WHERE id = p_campaign_id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'choix', p_choix);
END;
$$;

REVOKE ALL ON FUNCTION public.organizer_activation_feedback_record(uuid, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.organizer_activation_feedback_record(uuid, text, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.organizer_activation_feedback_record(uuid, text, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.organizer_activation_feedback_record(uuid, text, text, text) TO service_role;
