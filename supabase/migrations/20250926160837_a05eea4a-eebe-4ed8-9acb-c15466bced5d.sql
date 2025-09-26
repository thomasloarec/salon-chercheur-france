-- Supprimer la contrainte de clé étrangère qui bloque le backfill
ALTER TABLE public.participation DROP CONSTRAINT IF EXISTS participation_id_exposant_fkey;

-- Corriger la vue pour joindre sur le domaine
DROP VIEW IF EXISTS public.participations_with_exhibitors;

CREATE VIEW public.participations_with_exhibitors AS
SELECT
  p.id_participation,
  p.id_event,
  p.id_event_text,
  p.id_exposant,       -- conservé pour debug/historique
  p.stand_exposant,
  p.website_exposant,  -- domaine normalisé
  p.urlexpo_event,
  e.id              AS exhibitor_uuid,
  e.nom_exposant    AS exhibitor_name,
  e.website_exposant AS exhibitor_website,
  e.exposant_description
FROM public.participation p
LEFT JOIN public.exposants e
  ON btrim(p.website_exposant) = btrim(e.website_exposant);

-- Backfill participation.id_exposant pour Event_62
-- Cas 1 : id_exposant commence par 'Exporec' (ID Airtable) → remplacer par le domaine
UPDATE public.participation
SET id_exposant = website_exposant
WHERE id_event_text = 'Event_62'
  AND id_exposant LIKE 'Exporec%'
  AND website_exposant IS NOT NULL
  AND btrim(website_exposant) <> '';

-- Cas 2 : id_exposant vide ou NULL → remplir avec le domaine si présent
UPDATE public.participation
SET id_exposant = website_exposant
WHERE id_event_text = 'Event_62'
  AND (id_exposant IS NULL OR btrim(id_exposant) = '')
  AND website_exposant IS NOT NULL
  AND btrim(website_exposant) <> '';