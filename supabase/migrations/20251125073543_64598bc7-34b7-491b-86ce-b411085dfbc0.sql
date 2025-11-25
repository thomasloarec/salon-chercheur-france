-- Fix Security Definer View for participations_with_exhibitors
-- Apply same security settings as events_geo

DROP VIEW IF EXISTS public.participations_with_exhibitors;

-- Recreate with explicit security settings:
-- security_invoker = true: Use permissions of the querying user
-- security_barrier = true: Prevent query optimization from bypassing security checks
CREATE VIEW public.participations_with_exhibitors
WITH (security_invoker = true, security_barrier = true)
AS
SELECT 
  p.id_participation,
  p.id_event,
  p.id_event_text,
  p.stand_exposant,
  p.urlexpo_event,
  p.id_exposant,
  p.exhibitor_id,
  ex.id AS exhibitor_uuid,
  ex.name AS exhibitor_name,
  ex.website AS exhibitor_website,
  ex.description AS modern_description,
  ex.logo_url,
  ex.approved,
  ex.plan,
  ex.stand_info,
  old.nom_exposant AS legacy_name,
  old.website_exposant AS legacy_website,
  old.exposant_description AS legacy_description,
  COALESCE(ex.name, old.nom_exposant) AS name_final,
  COALESCE(ex.website, old.website_exposant, p.website_exposant) AS website_final,
  COALESCE(ex.description, old.exposant_description) AS description_final,
  COALESCE(old.website_exposant, p.website_exposant) AS website_exposant,
  COALESCE(old.exposant_description, ex.description) AS exposant_description,
  p.website_exposant AS participation_website
FROM participation p
LEFT JOIN exhibitors ex ON ex.id = p.exhibitor_id
LEFT JOIN exposants old ON old.id_exposant = p.id_exposant;

-- Grant explicit permissions
GRANT SELECT ON public.participations_with_exhibitors TO anon;
GRANT SELECT ON public.participations_with_exhibitors TO authenticated;