-- Corriger la population de event_sectors pour gérer les structures JSONB variées

-- D'abord, vider la table actuelle
DELETE FROM public.event_sectors;

-- Repeupler avec une logique robuste qui gère toutes les structures
INSERT INTO public.event_sectors (event_id, sector_id)
SELECT DISTINCT 
  e.id_event,
  s.id
FROM public.events e
CROSS JOIN public.sectors s
WHERE e.secteur IS NOT NULL 
  AND e.secteur != '[]'::jsonb
  AND (
    -- Structure [["secteur"]] (tableau de tableaux)
    jsonb_path_exists(e.secteur, '$[*][*] ? (@ == $sector)', jsonb_build_object('sector', s.name))
    OR
    -- Structure ["secteur1", "secteur2"] (tableau simple)
    jsonb_path_exists(e.secteur, '$[*] ? (@ == $sector)', jsonb_build_object('sector', s.name))
  );

-- Corriger aussi la fonction sync_event_sectors pour les futurs événements
CREATE OR REPLACE FUNCTION public.sync_event_sectors()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  v_sector record;
BEGIN
  -- Supprimer les anciens mappings
  DELETE FROM public.event_sectors WHERE event_id = NEW.id_event;

  -- Parcourir tous les secteurs pour trouver les correspondances
  FOR v_sector IN
    SELECT s.id, s.name
    FROM public.sectors s
    WHERE NEW.secteur IS NOT NULL 
      AND NEW.secteur != '[]'::jsonb
      AND (
        -- Structure [["secteur"]] (tableau de tableaux)
        jsonb_path_exists(NEW.secteur, '$[*][*] ? (@ == $sector)', jsonb_build_object('sector', s.name))
        OR
        -- Structure ["secteur1", "secteur2"] (tableau simple)
        jsonb_path_exists(NEW.secteur, '$[*] ? (@ == $sector)', jsonb_build_object('sector', s.name))
      )
  LOOP
    INSERT INTO public.event_sectors(event_id, sector_id)
    VALUES (NEW.id_event, v_sector.id)
    ON CONFLICT DO NOTHING;
  END LOOP;

  RETURN NEW;
END;
$function$;