-- WF5 — Lot 5 : exposition de activation_themes_envoyes dans la vue
-- d'eligibilite, pour que le Code node n8n choisisse l'angle de relance
-- sans requete supplementaire.
--
-- Note : CREATE OR REPLACE VIEW ne permet pas d'inserer une colonne au
-- milieu de la liste existante. La vue est donc recreee (DROP + CREATE),
-- ce qui impose de re-declarer security_invoker ET les GRANTs.

DROP VIEW IF EXISTS public.v_eligibles_activation_organisateur;

CREATE VIEW public.v_eligibles_activation_organisateur
WITH (security_invoker = true) AS
SELECT
  s.campaign_id,
  s.organizer_id,
  s.organizer_name,
  s.primary_domain,
  r.recipient_email  AS contact_email,
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
ORDER BY s.next_event_date NULLS LAST, s.activation_next_send_at, s.campaign_id;

REVOKE ALL ON public.v_eligibles_activation_organisateur FROM PUBLIC;
REVOKE ALL ON public.v_eligibles_activation_organisateur FROM anon;
REVOKE ALL ON public.v_eligibles_activation_organisateur FROM authenticated;
GRANT SELECT ON public.v_eligibles_activation_organisateur TO service_role;
