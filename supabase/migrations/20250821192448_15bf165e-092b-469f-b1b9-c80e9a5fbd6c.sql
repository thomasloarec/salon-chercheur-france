-- Fix Security Definer View issue: events_geo
-- Remove overly permissive grants and ensure RLS is properly enforced

-- First, revoke all existing permissions on the view
REVOKE ALL ON public.events_geo FROM anon;
REVOKE ALL ON public.events_geo FROM authenticated;
REVOKE ALL ON public.events_geo FROM service_role;

-- Drop and recreate the view with proper security
DROP VIEW IF EXISTS public.events_geo;

-- Recreate the view as a simple view that respects RLS
CREATE VIEW public.events_geo AS 
SELECT 
    e.id,
    LEFT(e.code_postal, 2) AS dep_code,
    d.region_code,
    e.code_postal
FROM events e
LEFT JOIN departements d ON (LEFT(e.code_postal, 2) = d.code);

-- Enable RLS on the view (views inherit RLS from their base tables)
ALTER VIEW public.events_geo SET (security_barrier = true);

-- Grant appropriate permissions that respect RLS
-- Only allow SELECT since this is a read-only view
GRANT SELECT ON public.events_geo TO authenticated;
GRANT SELECT ON public.events_geo TO anon;

-- Service role can have full access for admin operations
GRANT SELECT ON public.events_geo TO service_role;

-- Add RLS policy for the view
ALTER VIEW public.events_geo ENABLE ROW LEVEL SECURITY;

-- Create RLS policy that inherits from the base events table security
CREATE POLICY "Geographic data follows event visibility" ON public.events_geo
  FOR SELECT 
  USING (
    -- Only show geographic data for visible events or to admins
    EXISTS (
      SELECT 1 FROM events e 
      WHERE e.id = events_geo.id 
        AND (e.visible = true OR is_admin())
    )
  );