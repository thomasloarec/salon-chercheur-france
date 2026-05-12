
-- Data fix : fusion ARJO (legacy ExporecOmE1uKl3OojT0o → modern 1fbfea19-1f84-4836-a229-ab5a23f71cc4)

-- 1. Copier la description legacy sur l'exposant moderne si vide
UPDATE public.exhibitors
SET description = COALESCE(NULLIF(description, ''), (
    SELECT exposant_description FROM public.exposants WHERE id_exposant = 'ExporecOmE1uKl3OojT0o'
  )),
  website = COALESCE(NULLIF(website, ''), 'arjo.com')
WHERE id = '1fbfea19-1f84-4836-a229-ab5a23f71cc4';

-- 2. Supprimer la participation doublon Handi-4 Lyon créée par la duplication
DELETE FROM public.participation
WHERE id_exposant = '1fbfea19-1f84-4836-a229-ab5a23f71cc4'
  AND id_event_text = 'Event_360';

-- 3. Relier toutes les participations legacy ARJO au nouvel UUID moderne
UPDATE public.participation
SET exhibitor_id = '1fbfea19-1f84-4836-a229-ab5a23f71cc4'
WHERE id_exposant = 'ExporecOmE1uKl3OojT0o';

-- 4. Supprimer la ligne legacy doublon créée par exhibitors-manage (sans description)
DELETE FROM public.exposants
WHERE id_exposant = '1fbfea19-1f84-4836-a229-ab5a23f71cc4'
  AND (exposant_description IS NULL OR exposant_description = '');

-- 5. Aligner la ligne legacy avec description sur le nouvel UUID moderne
UPDATE public.exposants
SET id_exposant = '1fbfea19-1f84-4836-a229-ab5a23f71cc4'
WHERE id_exposant = 'ExporecOmE1uKl3OojT0o';
