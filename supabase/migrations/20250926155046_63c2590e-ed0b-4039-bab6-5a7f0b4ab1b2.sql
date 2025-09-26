-- Corriger les problèmes de sécurité SECURITY DEFINER
-- Recréer la vue participations_with_exhibitors sans SECURITY DEFINER
DROP VIEW IF EXISTS public.participations_with_exhibitors;

CREATE VIEW public.participations_with_exhibitors AS
SELECT
  p.id_participation,
  p.id_event,
  p.id_event_text,
  p.id_exposant,
  p.stand_exposant,
  p.website_exposant,
  p.urlexpo_event,
  e.id AS exhibitor_uuid,
  e.nom_exposant AS exhibitor_name,
  e.website_exposant AS exhibitor_website,
  e.exposant_description
FROM participation p
LEFT JOIN exposants e ON p.id_exposant = e.website_exposant;