
-- Amélioration de la fonction de conversion outreach
-- Ajoute des chemins de matching robustes au-delà du website
CREATE OR REPLACE FUNCTION public.check_novelty_conversion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  -- Chemin 1 : matching direct par exhibitor_id + event_id
  UPDATE outreach_campaigns
  SET campaign_status = 'converted',
      novelty_id = NEW.id,
      updated_at = now()
  WHERE event_id = NEW.event_id
    AND exhibitor_id = NEW.exhibitor_id
    AND campaign_status NOT IN ('converted', 'opted_out');

  -- Chemin 2 : matching via participation
  -- La participation lie l'exposant au salon ; on cherche les campagnes
  -- dont la participation pointe vers le même exhibitor_id moderne
  UPDATE outreach_campaigns oc
  SET campaign_status = 'converted',
      novelty_id = NEW.id,
      updated_at = now()
  FROM participation p
  WHERE oc.participation_id = p.id_participation
    AND p.exhibitor_id = NEW.exhibitor_id
    AND oc.event_id = NEW.event_id
    AND oc.campaign_status NOT IN ('converted', 'opted_out');

  -- Chemin 3 : fallback par website normalisé (logique existante)
  UPDATE outreach_campaigns oc
  SET campaign_status = 'converted',
      novelty_id = NEW.id,
      updated_at = now()
  FROM exhibitors ex
  WHERE ex.id = NEW.exhibitor_id
    AND oc.event_id = NEW.event_id
    AND ex.website IS NOT NULL
    AND oc.website IS NOT NULL
    AND (
      replace(replace(lower(oc.website), 'https://', ''), 'http://', '')
        LIKE '%' || replace(replace(lower(ex.website), 'https://', ''), 'http://', '') || '%'
      OR
      replace(replace(lower(ex.website), 'https://', ''), 'http://', '')
        LIKE '%' || replace(replace(lower(oc.website), 'https://', ''), 'http://', '') || '%'
    )
    AND oc.campaign_status NOT IN ('converted', 'opted_out');

  RETURN NEW;
END;
$function$;
