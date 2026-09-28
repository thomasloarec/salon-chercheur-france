-- Nouveauté modifiée par un exposant : retour en validation admin (28/09/2026).
-- 1. Si un non-admin modifie le contenu visible d'une nouveauté publiée (ou refusée),
--    elle repasse au statut 'draft' (onglet « À valider » de la modération admin, compteur
--    admin des nouveautés en attente). Elle n'est plus affichée sur le site tant que
--    l'admin ne l'a pas de nouveau publiée.
--    Contenu surveillé : titre, type, arguments, résumé, détails, images, brochure,
--    ressource, public visé. Le stand, les disponibilités et les créneaux de démo
--    peuvent changer sans nouvelle validation.
--    Admin et clé service (edge functions) : inchangés, aucun retour en validation.
-- 2. Les membres de l'équipe d'un exposant (et l'auteur) voient ses nouveautés en attente
--    ou refusées : sans cela, une nouveauté repassée en validation disparaissait de
--    l'espace exposant et une seconde modification échouait sans message.

CREATE OR REPLACE FUNCTION public.protect_novelty_columns()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Admins can do anything
  IF public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  -- Service role bypass
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Lock sensitive columns for non-admins
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.status := OLD.status;
  END IF;
  IF NEW.exhibitor_id IS DISTINCT FROM OLD.exhibitor_id THEN
    NEW.exhibitor_id := OLD.exhibitor_id;
  END IF;
  IF NEW.event_id IS DISTINCT FROM OLD.event_id THEN
    NEW.event_id := OLD.event_id;
  END IF;
  IF NEW.is_premium IS DISTINCT FROM OLD.is_premium THEN
    NEW.is_premium := OLD.is_premium;
  END IF;
  IF NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    NEW.created_by := OLD.created_by;
  END IF;
  IF NEW.pending_exhibitor_id IS DISTINCT FROM OLD.pending_exhibitor_id THEN
    NEW.pending_exhibitor_id := OLD.pending_exhibitor_id;
  END IF;
  IF NEW.is_test IS DISTINCT FROM OLD.is_test THEN
    NEW.is_test := OLD.is_test;
  END IF;
  IF NEW.origin IS DISTINCT FROM OLD.origin THEN
    NEW.origin := OLD.origin;
  END IF;

  -- Contenu visible modifié sur une nouveauté publiée ou refusée : nouvelle validation admin.
  IF OLD.status IN ('published', 'rejected') AND (
       NEW.title         IS DISTINCT FROM OLD.title
    OR NEW.type          IS DISTINCT FROM OLD.type
    OR NEW.reason_1      IS DISTINCT FROM OLD.reason_1
    OR NEW.reason_2      IS DISTINCT FROM OLD.reason_2
    OR NEW.reason_3      IS DISTINCT FROM OLD.reason_3
    OR NEW.summary       IS DISTINCT FROM OLD.summary
    OR NEW.details       IS DISTINCT FROM OLD.details
    OR NEW.media_urls    IS DISTINCT FROM OLD.media_urls
    OR NEW.doc_url       IS DISTINCT FROM OLD.doc_url
    OR NEW.resource_url  IS DISTINCT FROM OLD.resource_url
    OR NEW.audience_tags IS DISTINCT FROM OLD.audience_tags
  ) THEN
    NEW.status := 'draft';
  END IF;

  RETURN NEW;
END;
$function$;

DROP POLICY IF EXISTS "Team members can view their novelties" ON public.novelties;
CREATE POLICY "Team members can view their novelties"
  ON public.novelties FOR SELECT TO authenticated
  USING (public.is_team_member(exhibitor_id) OR created_by = auth.uid());
