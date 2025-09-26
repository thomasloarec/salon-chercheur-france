-- CREATE VIEW pour standardiser l'affichage des exposants par événement
-- Cette VIEW utilise la jointure sur le domaine normalisé comme demandé
CREATE OR REPLACE VIEW public.participations_with_exhibitors AS
SELECT
  p.id_participation,
  p.id_event,
  p.id_exposant,             -- domaine normalisé (texte)
  p.stand_exposant,
  p.website_exposant,
  p.urlexpo_event,
  e.id            AS exhibitor_uuid,
  e.nom_exposant  AS exhibitor_name,
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