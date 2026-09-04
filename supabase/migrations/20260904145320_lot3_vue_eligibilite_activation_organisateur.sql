-- ============================================================
-- WF5 — Lot 3 : vue d'eligibilite de la piste activation.
--
-- Source unique de verite pour WF5, sur le modele de WF3 : le workflow
-- n8n ne decide rien, il lit une ligne et l'envoie.
--
-- Garde-fous, dans l'ordre :
--   - activation_next_send_at DOIT etre non nul ET echu.
--     NULL ne signifie JAMAIS "envoyer maintenant" (bug corrige en aout
--     sur les vues exposant, on ne le reintroduit pas ici).
--   - opt_out, stop_reason (piste claim) et activation_stop_reason
--     coupent tous les trois.
--   - le destinataire doit etre resolu, non blackliste, non interne,
--     et unique (multi_owners = arbitrage manuel).
--   - E1 (step 0) part toujours : c'est l'accueil, il ne depend d'aucun gap.
--     A partir de E2, il faut au moins un gap reellement ouvert, sinon
--     l'organisateur travaille deja et on se tait.
--
-- Pas de cap cross-monde a 21 jours ici, volontairement : la personne
-- vient de revendiquer, c'est du cycle de vie produit et non de la
-- prospection. Un cap de 5 jours entre deux emails d'activation sert
-- de ceinture si le bookkeeping deraille.
-- ============================================================

CREATE OR REPLACE VIEW public.v_eligibles_activation_organisateur
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
  snap.snapshot ->  'themes_autorises' AS themes_autorises
FROM public.v_organizer_activation_state s
CROSS JOIN LATERAL public.get_organizer_activation_recipient(s.campaign_id) r
CROSS JOIN LATERAL (
  SELECT public.get_organizer_activation_snapshot(s.campaign_id) AS snapshot
) snap
WHERE s.activation_status = 'active'
  AND s.activation_step < 4
  AND s.opt_out = false
  AND s.outreach_blocked = false
  AND s.activation_stop_reason IS NULL
  -- La date doit exister ET etre echue.
  AND s.activation_next_send_at IS NOT NULL
  AND s.activation_next_send_at <= now()
  -- Ceinture : jamais deux emails d'activation a moins de 5 jours.
  AND (s.activation_last_sent_at IS NULL
       OR s.activation_last_sent_at <= now() - interval '5 days')
  -- Destinataire exploitable.
  AND r.recipient_email IS NOT NULL
  AND r.block_reason IS NULL
  -- Il faut au moins un salon a venir a raconter.
  AND (snap.snapshot ->> 'nb_salons_a_venir')::int > 0
  -- E1 part toujours. Ensuite, il faut un manque reel.
  AND (s.activation_step = 0 OR snap.snapshot ->> 'next_action' IS NOT NULL)
ORDER BY s.next_event_date NULLS LAST, s.activation_next_send_at, s.campaign_id;

REVOKE ALL ON public.v_eligibles_activation_organisateur FROM PUBLIC;
REVOKE ALL ON public.v_eligibles_activation_organisateur FROM anon;
REVOKE ALL ON public.v_eligibles_activation_organisateur FROM authenticated;
GRANT SELECT ON public.v_eligibles_activation_organisateur TO service_role;
