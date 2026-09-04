-- ============================================================
-- WF5 — Lot 0 : amorcage de la piste activation pour les
-- organisateurs ayant deja revendique au moins un salon.
--
-- Solucop est place a activation_step = 1 : l'email #1 lui a ete
-- envoye manuellement le 04/09/2026. Il ne doit pas le recevoir
-- une seconde fois.
-- ============================================================

UPDATE public.organizer_outreach_campaigns c
SET activation_status      = 'active',
    activation_started_at  = COALESCE(c.activation_started_at, now()),
    activation_step        = CASE WHEN o.primary_domain = 'solucop.com' THEN 1 ELSE 0 END,
    activation_last_sent_at = CASE WHEN o.primary_domain = 'solucop.com' THEN now() ELSE NULL END,
    -- Solucop : E2 a J+8 de l'envoi manuel. Les autres : E1 des le premier run WF5.
    activation_next_send_at = CASE WHEN o.primary_domain = 'solucop.com'
                                   THEN now() + interval '8 days'
                                   ELSE now() END,
    updated_at             = now()
FROM public.organizers o
WHERE o.id = c.organizer_id
  AND c.activation_status = 'not_started'
  AND c.opt_out = false
  AND o.outreach_blocked = false
  AND EXISTS (
    SELECT 1
    FROM public.organizer_domains od
    JOIN public.events e ON e.url_site_officiel_domain = od.domain
    WHERE od.organizer_id = o.id
      AND e.visible = true
      AND COALESCE(e.is_test, false) = false
      AND e.owner_user_id IS NOT NULL
  );
