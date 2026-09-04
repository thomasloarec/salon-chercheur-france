-- ============================================================
-- WF5 — Mode test d'envoi.
--
-- Probleme : trois organisateurs reels sont eligibles a l'instant.
-- Activer WF5 pour "voir si ca marche" enverrait immediatement un vrai
-- email a un vrai organisateur, sans repetition possible.
--
-- Solution : un singleton de configuration qui, lorsqu'il est actif,
--   - restreint la file a une seule campagne (only_campaign_id) ;
--   - redirige le destinataire vers redirect_email.
--
-- L'email produit est exactement celui que l'organisateur recevrait,
-- avec ses vraies donnees, mais il arrive dans la boite de test. Aucun
-- evenement n'a besoin d'etre revendique ni cree pour tester.
--
-- Table vide ou enabled=false => comportement normal. L'echec est donc
-- toujours du cote sur.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.outreach_test_mode (
  id               boolean PRIMARY KEY DEFAULT true CHECK (id),   -- singleton
  enabled          boolean NOT NULL DEFAULT false,
  redirect_email   text,
  only_campaign_id uuid,
  note             text,
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT outreach_test_mode_coherence
    CHECK (enabled = false OR (redirect_email IS NOT NULL AND redirect_email LIKE '%@%'))
);

INSERT INTO public.outreach_test_mode (id, enabled, note)
VALUES (true, false, 'Desactive par defaut')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.outreach_test_mode ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage outreach test mode" ON public.outreach_test_mode;
CREATE POLICY "Admins manage outreach test mode"
  ON public.outreach_test_mode FOR ALL
  USING (is_admin()) WITH CHECK (is_admin());

REVOKE ALL ON public.outreach_test_mode FROM anon;
REVOKE ALL ON public.outreach_test_mode FROM authenticated;

-- ------------------------------------------------------------
-- Vue d'eligibilite : prise en compte du mode test.
-- Recreee (DROP + CREATE) car l'ordre des colonnes change.
-- security_invoker et GRANTs re-declares explicitement.
-- ------------------------------------------------------------
DROP VIEW IF EXISTS public.v_eligibles_activation_organisateur;

CREATE VIEW public.v_eligibles_activation_organisateur
WITH (security_invoker = true) AS
SELECT
  s.campaign_id,
  s.organizer_id,
  s.organizer_name,
  s.primary_domain,
  -- En mode test, l'email part vers la boite de test, jamais vers l'organisateur.
  CASE WHEN tm.enabled THEN tm.redirect_email ELSE r.recipient_email END AS contact_email,
  r.recipient_email AS destinataire_reel,
  tm.enabled        AS mode_test,
  r.first_name,
  r.owner_user_id,
  s.activation_step,
  s.activation_next_send_at,
  s.first_claimed_at,
  s.nb_salons_revendiques,
  s.next_event_date,
  snap.snapshot,
  snap.snapshot ->> 'next_action'      AS next_action,
  snap.snapshot ->  'themes_autorises' AS themes_autorises,
  public.get_organizer_activation_themes_interdits(s.campaign_id) AS themes_interdits,
  c.activation_themes_envoyes
FROM public.v_organizer_activation_state s
JOIN public.organizer_outreach_campaigns c ON c.id = s.campaign_id
CROSS JOIN LATERAL public.get_organizer_activation_recipient(s.campaign_id) r
CROSS JOIN LATERAL (
  SELECT public.get_organizer_activation_snapshot(s.campaign_id) AS snapshot
) snap
LEFT JOIN public.outreach_test_mode tm ON tm.id = true
WHERE s.activation_status = 'active'
  AND s.activation_step < 4
  AND s.opt_out = false
  AND s.outreach_blocked = false
  AND s.activation_stop_reason IS NULL
  AND s.activation_next_send_at IS NOT NULL
  AND s.activation_next_send_at <= now()
  AND (s.activation_last_sent_at IS NULL
       OR s.activation_last_sent_at <= now() - interval '5 days')
  AND r.recipient_email IS NOT NULL
  AND r.block_reason IS NULL
  AND (snap.snapshot ->> 'nb_salons_a_venir')::int > 0
  AND (s.activation_step = 0 OR snap.snapshot ->> 'next_action' IS NOT NULL)
  -- Mode test : file restreinte a la seule campagne designee.
  AND (NOT COALESCE(tm.enabled, false)
       OR tm.only_campaign_id IS NULL
       OR tm.only_campaign_id = s.campaign_id)
ORDER BY s.next_event_date NULLS LAST, s.activation_next_send_at, s.campaign_id;

REVOKE ALL ON public.v_eligibles_activation_organisateur FROM PUBLIC;
REVOKE ALL ON public.v_eligibles_activation_organisateur FROM anon;
REVOKE ALL ON public.v_eligibles_activation_organisateur FROM authenticated;
GRANT SELECT ON public.v_eligibles_activation_organisateur TO service_role;
