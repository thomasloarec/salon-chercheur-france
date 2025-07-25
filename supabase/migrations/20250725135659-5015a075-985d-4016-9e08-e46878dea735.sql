-- Script de synchronisation event_sectors (Option A)
-- Réalimentation depuis events_import (source fiable)

BEGIN;

-- Nettoyage sécurisé de la table actuellement vide
TRUNCATE public.event_sectors;

-- Réalimentation depuis events_import
INSERT INTO public.event_sectors (event_id, sector_id)
SELECT DISTINCT
  ei.id_event,
  s.id
FROM public.events_import ei
CROSS JOIN LATERAL unnest(ei.secteur) AS sect(name)
JOIN public.sectors s ON s.name = sect.name
WHERE ei.secteur IS NOT NULL;

COMMIT;