-- Correction : retrait de meta_description_gen de protect_event_owner_columns.
-- meta_description_gen n'est PAS la phrase affichee (c'est event_ai.accroche) ; le laisser ici
-- gelait la regeneration SEO de la meta sur les salons revendiques. Retour aux 8 champs d'origine.
CREATE OR REPLACE FUNCTION public.protect_event_owner_columns()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Admin : accès total (édition admin + application d'un change-request sous JWT admin)
  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  -- Signal transactionnel posé uniquement par admin_apply_event_change()
  IF coalesce(current_setting('app.event_change_apply', true), '') = '1' THEN
    RETURN NEW;
  END IF;

  -- Sinon : on restaure les champs éditoriaux possédés par l'organisateur.
  NEW.nom_event         := OLD.nom_event;
  NEW.date_debut        := OLD.date_debut;
  NEW.date_fin          := OLD.date_fin;
  NEW.secteur           := OLD.secteur;
  NEW.affluence         := OLD.affluence;
  NEW.tarif             := OLD.tarif;
  NEW.url_image         := OLD.url_image;
  NEW.description_event := OLD.description_event;

  RETURN NEW;
END;
$function$;
