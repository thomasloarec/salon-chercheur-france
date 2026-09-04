-- ============================================================
-- WF5 — Lot 5 : memoire des themes deja traites + retours en un clic.
--
-- 1. activation_themes_envoyes evite que E3 repete E2 mot pour mot
--    quand le meme manque reste ouvert. Si le theme a deja ete traite,
--    la relance change d'angle : E2 dit pourquoi, E3 dit comment.
--
-- 2. organizer_activation_feedback capture le frein reel plutot que le
--    silence. C'est le pendant des liens de decline de WF3, qui se sont
--    reveles le meilleur signal qualitatif de la sequence exposant.
-- ============================================================

ALTER TABLE public.organizer_outreach_campaigns
  ADD COLUMN IF NOT EXISTS activation_themes_envoyes text[] NOT NULL DEFAULT ARRAY[]::text[];

COMMENT ON COLUMN public.organizer_outreach_campaigns.activation_themes_envoyes IS
  'Themes deja traites par la sequence d''activation. Pilote le changement d''angle des relances.';

CREATE TABLE IF NOT EXISTS public.organizer_activation_feedback (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id          uuid NOT NULL REFERENCES public.organizer_outreach_campaigns(id) ON DELETE CASCADE,
  organizer_id         uuid REFERENCES public.organizers(id) ON DELETE SET NULL,
  choix                text NOT NULL CHECK (choix IN (
                         'pas_le_temps',      -- interesse mais pas dispo
                         'pas_le_bon_contact',-- ce n'est pas moi qui gere
                         'donnees_indispo',   -- je n'ai pas encore l'info
                         'pas_interesse',     -- arret de la sequence
                         'aidez_moi'          -- demande de prise en charge
                       )),
  theme                text,
  activation_step      integer,
  user_agent           text,
  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_activation_feedback_campaign
  ON public.organizer_activation_feedback (campaign_id, created_at DESC);

ALTER TABLE public.organizer_activation_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage activation feedback" ON public.organizer_activation_feedback;
CREATE POLICY "Admins manage activation feedback"
  ON public.organizer_activation_feedback FOR ALL
  USING (is_admin()) WITH CHECK (is_admin());

REVOKE ALL ON public.organizer_activation_feedback FROM anon;
REVOKE ALL ON public.organizer_activation_feedback FROM authenticated;

-- ------------------------------------------------------------
-- Enregistrement d'un retour. Appelee par une Edge Function publique
-- (lien clique dans l'email), donc SECURITY DEFINER.
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

  INSERT INTO public.organizer_activation_feedback
    (campaign_id, organizer_id, choix, theme, activation_step, user_agent)
  VALUES
    (p_campaign_id, v_org, p_choix, p_theme, v_step, left(COALESCE(p_user_agent, ''), 400));

  -- Effets sur la sequence, selon le retour.
  IF p_choix = 'pas_interesse' THEN
    UPDATE public.organizer_outreach_campaigns
    SET activation_status      = 'stopped',
        activation_stop_reason = 'feedback_pas_interesse',
        activation_stopped_at  = now(),
        activation_next_send_at = NULL,
        updated_at             = now()
    WHERE id = p_campaign_id;

  ELSIF p_choix IN ('pas_le_bon_contact','aidez_moi') THEN
    -- On arrete l'automatique : ces deux cas appellent une reponse humaine.
    UPDATE public.organizer_outreach_campaigns
    SET activation_status      = 'stopped',
        activation_stop_reason = 'feedback_' || p_choix,
        activation_stopped_at  = now(),
        activation_next_send_at = NULL,
        updated_at             = now()
    WHERE id = p_campaign_id;

  ELSIF p_choix IN ('pas_le_temps','donnees_indispo') THEN
    -- Interesse mais pas maintenant : on repousse de 30 jours.
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
