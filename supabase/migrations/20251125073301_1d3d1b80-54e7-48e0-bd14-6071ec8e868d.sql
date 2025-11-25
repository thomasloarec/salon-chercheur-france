-- Fix Security Definer View linter error
-- Recreate events_geo view with explicit security_invoker and security_barrier

DROP VIEW IF EXISTS public.events_geo;

-- Create the view with explicit security settings:
-- security_invoker = true: Use permissions of the querying user (not the view creator)
-- security_barrier = true: Prevent query optimization from bypassing security checks
CREATE VIEW public.events_geo 
WITH (security_invoker = true, security_barrier = true)
AS
SELECT  e.*,
        c.id          AS commune_id,
        c.dep_code    AS dep_code,
        d.region_code AS region_code
FROM    public.events e
JOIN LATERAL (
  SELECT *
  FROM   communes
  WHERE  (e.code_postal IS NOT NULL AND code_postal = e.code_postal)
     OR  LOWER(unaccent(nom)) = LOWER(unaccent(e.ville))
  ORDER  BY (code_postal = e.code_postal) DESC
  LIMIT 1
) c  ON true
JOIN   public.departements d ON d.code = c.dep_code;

-- Grant explicit permissions to anon and authenticated roles
GRANT SELECT ON public.events_geo TO anon;
GRANT SELECT ON public.events_geo TO authenticated;