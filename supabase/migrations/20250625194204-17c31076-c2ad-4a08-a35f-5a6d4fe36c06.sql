
-- 1. Nettoyage : supprimer les index qui auraient pu être créés par erreur sur la vue
DROP INDEX IF EXISTS idx_events_geo_dep;
DROP INDEX IF EXISTS idx_events_geo_region;
DROP INDEX IF EXISTS idx_events_geo_city;
DROP INDEX IF EXISTS idx_events_geo_start_date;

-- 2. Index sur les tables sources (sans fonctions non-immutables)
-- Index sur le nom des communes pour le JOIN
CREATE INDEX IF NOT EXISTS idx_communes_nom_lower
  ON public.communes (LOWER(nom));

-- Index sur la ville des événements pour les filtres
CREATE INDEX IF NOT EXISTS idx_events_city_lower
  ON public.events (LOWER(city));

-- Index sur la date de début pour les tris
CREATE INDEX IF NOT EXISTS idx_events_start_date
  ON public.events(start_date);

-- Index sur les départements et régions pour les filtres géographiques
CREATE INDEX IF NOT EXISTS idx_communes_dep_code 
  ON public.communes(dep_code);

CREATE INDEX IF NOT EXISTS idx_departements_region_code 
  ON public.departements(region_code);
