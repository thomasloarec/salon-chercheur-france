-- (A) Ajouter la colonne texte "Event_XX" côté participation si absente
ALTER TABLE IF EXISTS participation
  ADD COLUMN IF NOT EXISTS id_event_text TEXT;

-- (B) Index pour filtres par event texte
CREATE INDEX IF NOT EXISTS participation_id_event_text_idx
  ON participation (id_event_text);

-- (C) Backfill cohérent : remplir participation.id_event_text à partir de l'UUID
UPDATE participation p
SET id_event_text = e.id_event
FROM events e
WHERE p.id_event IS NOT NULL
  AND p.id_event_text IS NULL
  AND p.id_event = e.id;

-- (D) Supprimer et recréer la VIEW pour exposer id_event_text
DROP VIEW IF EXISTS public.participations_with_exhibitors;

CREATE VIEW public.participations_with_exhibitors AS
SELECT
  p.id_participation,
  p.id_event_text,                 -- <— clé "Event_XX"
  p.id_event,                      -- conservé à titre informatif (nullable)
  p.id_exposant,                   -- domaine texte
  p.stand_exposant,
  p.website_exposant,
  p.urlexpo_event,
  e.id              AS exhibitor_uuid,
  e.nom_exposant    AS exhibitor_name,
  e.website_exposant AS exhibitor_website,
  e.exposant_description
FROM public.participation p
LEFT JOIN public.exposants e
  ON lower(
       regexp_replace(
         regexp_replace(coalesce(e.website_exposant,''), '^https?://', '', 'i'),
         '^www\.', '', 'i'
       )
     ) = lower(coalesce(p.id_exposant,''));