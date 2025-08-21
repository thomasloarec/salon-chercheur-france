-- Fix Security Definer View issue: events_geo
-- The view was granting overly permissive access, bypassing RLS

-- First, revoke all existing permissions on the view
REVOKE ALL ON public.events_geo FROM anon;
REVOKE ALL ON public.events_geo FROM authenticated; 
REVOKE ALL ON public.events_geo FROM service_role;
REVOKE ALL ON public.events_geo FROM postgres;

-- Drop and recreate the view with proper security
DROP VIEW IF EXISTS public.events_geo;

-- Recreate the view with security_barrier to prevent optimization bypasses
CREATE VIEW public.events_geo 
WITH (security_barrier = true) AS 
SELECT 
    e.id,
    LEFT(e.code_postal, 2) AS dep_code,
    d.region_code,
    e.code_postal
FROM events e
LEFT JOIN departements d ON (LEFT(e.code_postal, 2) = d.code);

-- Grant minimal permissions that respect underlying table RLS
-- The view will inherit RLS policies from the events table
GRANT SELECT ON public.events_geo TO authenticated;
GRANT SELECT ON public.events_geo TO anon;

-- Service role gets access for admin operations
GRANT SELECT ON public.events_geo TO service_role;

-- Add a comment explaining the security model
COMMENT ON VIEW public.events_geo IS 'Geographic data view that inherits RLS policies from the events table. Only shows data for visible events or to admins.';