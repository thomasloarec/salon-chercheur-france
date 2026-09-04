-- ============================================================
-- WF5 — Lot 0 : vue d'etat de la piste activation.
-- Diagnostic en lecture seule. Ne decide pas encore des envois
-- (c'est le role de la vue d'eligibilite du lot 3).
-- Ancre temporelle = MIN(reviewed_at) des revendications approuvees.
-- ============================================================

CREATE OR REPLACE VIEW public.v_organizer_activation_state
WITH (security_invoker = true) AS
WITH salons_revendiques AS (
  SELECT
    o.id                                   AS organizer_id,
    e.id                                   AS event_id,
    e.nom_event,
    e.slug                                 AS event_slug,
    e.type_event,
    e.date_debut,
    e.owner_user_id,
    MIN(cr.reviewed_at)                    AS claimed_at
  FROM public.organizers o
  JOIN public.organizer_domains od      ON od.organizer_id = o.id
  JOIN public.events e                  ON e.url_site_officiel_domain = od.domain
                                       AND e.visible = true
                                       AND COALESCE(e.is_test, false) = false
                                       AND e.owner_user_id IS NOT NULL
  LEFT JOIN public.event_claim_requests cr ON cr.event_id = e.id
                                       AND cr.requester_user_id = e.owner_user_id
                                       AND cr.status = 'approved'
  GROUP BY o.id, e.id, e.nom_event, e.slug, e.type_event, e.date_debut, e.owner_user_id
)
SELECT
  c.id                                       AS campaign_id,
  o.id                                       AS organizer_id,
  o.name                                     AS organizer_name,
  o.primary_domain,
  o.outreach_blocked,
  c.activation_status,
  c.activation_step,
  c.activation_started_at,
  c.activation_last_sent_at,
  c.activation_next_send_at,
  c.activation_stop_reason,
  c.opt_out,
  COUNT(sr.event_id)                                              AS nb_salons_revendiques,
  COUNT(sr.event_id) FILTER (WHERE sr.date_debut >= CURRENT_DATE) AS nb_salons_revendiques_a_venir,
  MIN(sr.claimed_at)                                              AS first_claimed_at,
  MAX(sr.claimed_at)                                              AS last_claimed_at,
  MIN(sr.date_debut) FILTER (WHERE sr.date_debut >= CURRENT_DATE) AS next_event_date,
  COUNT(DISTINCT sr.owner_user_id)                                AS nb_owners_distincts,
  -- Un seul proprietaire attendu en V1 (single owner). >1 = arbitrage manuel.
  (array_agg(sr.owner_user_id ORDER BY sr.claimed_at))[1]         AS primary_owner_user_id
FROM public.organizers o
JOIN public.organizer_outreach_campaigns c ON c.organizer_id = o.id
JOIN salons_revendiques sr                 ON sr.organizer_id = o.id
GROUP BY c.id, o.id, o.name, o.primary_domain, o.outreach_blocked,
         c.activation_status, c.activation_step, c.activation_started_at,
         c.activation_last_sent_at, c.activation_next_send_at,
         c.activation_stop_reason, c.opt_out;

REVOKE ALL ON public.v_organizer_activation_state FROM PUBLIC;
REVOKE ALL ON public.v_organizer_activation_state FROM anon;
REVOKE ALL ON public.v_organizer_activation_state FROM authenticated;
GRANT SELECT ON public.v_organizer_activation_state TO service_role;
