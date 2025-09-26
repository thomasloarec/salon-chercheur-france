-- 1) Backfill id_exposant depuis website_exposant
UPDATE participation
SET id_exposant = website_exposant
WHERE (id_exposant IS NULL OR btrim(id_exposant) = '')
  AND website_exposant IS NOT NULL
  AND btrim(website_exposant) <> '';

-- 2) Corriger la VIEW participations_with_exhibitors pour être plus tolérante
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