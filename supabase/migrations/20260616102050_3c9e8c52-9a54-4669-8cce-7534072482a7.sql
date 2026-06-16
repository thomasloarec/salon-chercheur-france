CREATE OR REPLACE VIEW public.v_eligibles_revendication AS
SELECT oc.id,
    c.contact_email,
    c.first_name,
    oc.company_name,
    e.nom_event,
    slug.public_slug,
    oc.claim_step,
    ( SELECT count(*) AS count
           FROM outreach_campaigns oc2
          WHERE oc2.event_id = oc.event_id AND oc2.claim_status = 'claimed'::text) AS claimed_count,
    oc.next_send_at
   FROM outreach_campaigns oc
     JOIN events e ON e.id = oc.event_id
     LEFT JOIN participation p ON p.id_participation = oc.participation_id
     LEFT JOIN outreach_contacts c ON c.outreach_campaign_id = oc.id AND c.is_primary = true
     LEFT JOIN LATERAL ( SELECT COALESCE(( SELECT epi.public_slug
                   FROM exhibitor_public_identities epi
                  WHERE epi.exhibitor_id = oc.exhibitor_id AND epi.is_active = true
                 LIMIT 1), ( SELECT epi.public_slug
                   FROM exhibitor_public_identities epi
                  WHERE epi.exhibitor_id = p.exhibitor_id AND epi.is_active = true
                 LIMIT 1), ( SELECT epi.public_slug
                   FROM exhibitor_public_identities epi
                  WHERE epi.legacy_exposant_id = oc.id_exposant_legacy AND epi.is_active = true
                 LIMIT 1), ( SELECT epi.public_slug
                   FROM exhibitor_public_identities epi
                  WHERE epi.legacy_exposant_id = p.id_exposant AND epi.is_active = true
                 LIMIT 1)) AS public_slug) slug ON true
  WHERE oc.hunter_status = 'ready'::text AND c.contact_email IS NOT NULL AND (oc.claim_status = ANY (ARRAY['pending'::text, 'active'::text])) AND oc.opt_out = false AND oc.claim_step < 3 AND (oc.next_send_at IS NULL OR oc.next_send_at <= now()) AND e.date_debut >= (CURRENT_DATE + 3) AND e.date_debut <= (CURRENT_DATE + 90) AND e.visible = true AND e.is_test = false AND slug.public_slug IS NOT NULL
  ORDER BY oc.claim_step DESC, oc.next_send_at NULLS FIRST, oc.id;

GRANT SELECT ON public.v_eligibles_revendication TO service_role;

CREATE OR REPLACE VIEW public.v_eligibles_nouveaute AS
SELECT oc.id,
    c.contact_email,
    c.first_name,
    oc.company_name,
    e.nom_event,
    slug.public_slug,
    oc.novelty_step,
    oc.next_send_at,
    oc.event_id,
    e.date_debut,
    e.slug AS event_slug
   FROM outreach_campaigns oc
     JOIN events e ON e.id = oc.event_id
     LEFT JOIN participation p ON p.id_participation = oc.participation_id
     LEFT JOIN outreach_contacts c ON c.outreach_campaign_id = oc.id AND c.is_primary = true
     LEFT JOIN LATERAL ( SELECT COALESCE(( SELECT epi.public_slug
                   FROM exhibitor_public_identities epi
                  WHERE epi.exhibitor_id = oc.exhibitor_id AND epi.is_active = true
                 LIMIT 1), ( SELECT epi.public_slug
                   FROM exhibitor_public_identities epi
                  WHERE epi.exhibitor_id = p.exhibitor_id AND epi.is_active = true
                 LIMIT 1), ( SELECT epi.public_slug
                   FROM exhibitor_public_identities epi
                  WHERE epi.legacy_exposant_id = oc.id_exposant_legacy AND epi.is_active = true
                 LIMIT 1), ( SELECT epi.public_slug
                   FROM exhibitor_public_identities epi
                  WHERE epi.legacy_exposant_id = p.id_exposant AND epi.is_active = true
                 LIMIT 1)) AS public_slug) slug ON true
  WHERE oc.claim_status = 'claimed'::text AND oc.novelty_status = 'active'::text AND oc.opt_out = false AND oc.novelty_step < 3 AND (oc.next_send_at IS NULL OR oc.next_send_at <= now()) AND e.date_debut >= (CURRENT_DATE + 3) AND e.visible = true AND e.is_test = false AND NOT (EXISTS ( SELECT 1
           FROM novelties n
          WHERE n.exhibitor_id = oc.exhibitor_id AND n.event_id = oc.event_id AND n.status = 'published'::text AND n.is_test = false))
  ORDER BY oc.novelty_step DESC, oc.next_send_at NULLS FIRST, oc.id;

GRANT SELECT ON public.v_eligibles_nouveaute TO service_role;