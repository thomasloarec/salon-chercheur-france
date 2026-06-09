
CREATE OR REPLACE VIEW public.v_a_classifier AS
SELECT
  oc.id,
  oc.company_name,
  oc.website
FROM public.outreach_campaigns oc
WHERE oc.hunter_status = 'ready'
  AND oc.claude_classification IS NULL;

GRANT SELECT ON public.v_a_classifier TO anon;
GRANT SELECT ON public.v_a_classifier TO authenticated;
GRANT ALL ON public.v_a_classifier TO service_role;
