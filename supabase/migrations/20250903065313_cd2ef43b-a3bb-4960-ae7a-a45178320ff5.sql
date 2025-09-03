-- Fix security definer view issue
-- The events_geo view should not use SECURITY DEFINER as it can bypass RLS

-- Drop and recreate the events_geo view without SECURITY DEFINER
DROP VIEW IF EXISTS public.events_geo;

-- Recreate the view with proper security settings
-- This view provides geographic data for events and should inherit RLS from the events table
CREATE VIEW public.events_geo 
WITH (security_barrier = true) AS
SELECT 
  e.id,
  LEFT(e.code_postal, 2) as dep_code,
  d.region_code,
  e.code_postal
FROM public.events e
LEFT JOIN public.departements d ON LEFT(e.code_postal, 2) = d.code
WHERE e.visible = true;

-- Grant appropriate access to the view
GRANT SELECT ON public.events_geo TO authenticated, anon;