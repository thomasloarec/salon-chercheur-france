-- Fix v_outreach_campaigns_missing: resolve company_name from legacy source via name_final
-- Only the company_name expression changes; all columns, joins, filters identical.
CREATE OR REPLACE VIEW public.v_outreach_campaigns_missing AS
SELECT p.id_participation,
    p.id_event,
    p.exhibitor_id,
    COALESCE(NULLIF(TRIM(BOTH FROM p.name_final), ''::text), 'Exhibitor sans nom'::text) AS company_name,
    p.website_exposant AS website,
    p.id_exposant AS id_exposant_legacy
   FROM participations_with_exhibitors p
     JOIN v_events_outreach_eligible v ON v.id = p.id_event
     LEFT JOIN exhibitors ex ON ex.id = p.exhibitor_id
     LEFT JOIN outreach_campaigns oc ON oc.participation_id = p.id_participation
  WHERE p.website_exposant IS NOT NULL AND TRIM(BOTH FROM p.website_exposant) <> ''::text AND oc.id IS NULL;

-- Re-assert identical grants (CREATE OR REPLACE preserves them; restated for safety)
GRANT ALL ON public.v_outreach_campaigns_missing TO anon;
GRANT ALL ON public.v_outreach_campaigns_missing TO authenticated;
GRANT ALL ON public.v_outreach_campaigns_missing TO service_role;