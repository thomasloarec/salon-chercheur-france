-- Fix: Ensure events_geo view has no SECURITY DEFINER and uses security_barrier for safe predicate handling
BEGIN;

-- Recreate the view to guarantee clean state
DROP VIEW IF EXISTS public.events_geo CASCADE;

CREATE VIEW public.events_geo AS
SELECT 
  e.id,
  LEFT(e.code_postal, 2) AS dep_code,
  e.code_postal,
  d.region_code
FROM public.events e
LEFT JOIN public.departements d 
  ON LEFT(e.code_postal, 2) = d.code
WHERE e.visible = true;

-- Harden view planning to prevent unsafe qual pushdown
ALTER VIEW public.events_geo SET (security_barrier = true);

-- Restrict default grants and add explicit read grants
REVOKE ALL ON public.events_geo FROM PUBLIC;
GRANT SELECT ON public.events_geo TO anon, authenticated;

COMMIT;