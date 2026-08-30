-- Lot 1 : rendre meta_description_gen (phrase de presentation courte) editable
-- via le circuit change-request organisateur + validation admin, et le proteger
-- au meme titre que description_event pour les evenements revendiques.

-- 1) Application admin : ajout du champ a la liste blanche + garde-fou longueur 160.
CREATE OR REPLACE FUNCTION public.admin_apply_event_change(p_request_id uuid, p_admin_user_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_event_id uuid;
  v_status   text;
  pc         jsonb;
BEGIN
  SELECT event_id, status, proposed_changes
    INTO v_event_id, v_status, pc
  FROM public.event_change_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Change request % introuvable', p_request_id;
  END IF;
  IF v_status <> 'pending' THEN
    RAISE EXCEPTION 'Change request % déjà traité (statut=%)', p_request_id, v_status;
  END IF;

  -- Garde-fou longueur : phrase de presentation limitee a 160 caracteres.
  IF pc ? 'meta_description_gen'
     AND length(pc->>'meta_description_gen') > 160 THEN
    RAISE EXCEPTION 'meta_description_gen dépasse 160 caractères (% caractères)',
      length(pc->>'meta_description_gen');
  END IF;

  PERFORM set_config('app.event_change_apply', '1', true);

  UPDATE public.events e SET
    nom_event         = CASE WHEN pc ? 'nom_event'         THEN pc->>'nom_event'                    ELSE e.nom_event END,
    date_debut        = CASE WHEN pc ? 'date_debut'        THEN NULLIF(pc->>'date_debut','')::date  ELSE e.date_debut END,
    date_fin          = CASE WHEN pc ? 'date_fin'          THEN NULLIF(pc->>'date_fin','')::date    ELSE e.date_fin END,
    secteur           = CASE WHEN pc ? 'secteur'           THEN pc->'secteur'                       ELSE e.secteur END,
    affluence         = CASE WHEN pc ? 'affluence'         THEN pc->>'affluence'                    ELSE e.affluence END,
    tarif             = CASE WHEN pc ? 'tarif'             THEN pc->>'tarif'                        ELSE e.tarif END,
    url_image         = CASE WHEN pc ? 'url_image'         THEN pc->>'url_image'                    ELSE e.url_image END,
    description_event = CASE WHEN pc ? 'description_event' THEN pc->>'description_event'            ELSE e.description_event END,
    -- Propagation vers la description AFFICHÉE quand la description change :
    description_enrichie  = CASE WHEN pc ? 'description_event' THEN pc->>'description_event' ELSE e.description_enrichie END,
    enrichissement_statut = CASE WHEN pc ? 'description_event' THEN 'valide'                 ELSE e.enrichissement_statut END,
    -- Score SEO recalculé au prochain revalidate (le stocké devient obsolète) :
    seo_quality_score  = CASE WHEN pc ? 'description_event' THEN NULL ELSE e.seo_quality_score END,
    seo_quality_report = CASE WHEN pc ? 'description_event' THEN NULL ELSE e.seo_quality_report END,
    -- Phrase de presentation courte : editable via change-request, SANS invalidation du score SEO.
    meta_description_gen = CASE WHEN pc ? 'meta_description_gen' THEN pc->>'meta_description_gen' ELSE e.meta_description_gen END,
    updated_at        = now()
  WHERE e.id = v_event_id;

  UPDATE public.event_change_requests SET
    status = 'approved', reviewed_by = p_admin_user_id,
    reviewed_at = now(), applied_at = now()
  WHERE id = p_request_id;

  RETURN v_event_id;
END;
$function$;

-- 2) Verrou proprietaire : meta_description_gen restaure comme description_event
--    (ni la regeneration SEO ni le reimport Airtable ne l'ecrasent sur un salon revendique).
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
  NEW.nom_event            := OLD.nom_event;
  NEW.date_debut           := OLD.date_debut;
  NEW.date_fin             := OLD.date_fin;
  NEW.secteur              := OLD.secteur;
  NEW.affluence            := OLD.affluence;
  NEW.tarif                := OLD.tarif;
  NEW.url_image            := OLD.url_image;
  NEW.description_event    := OLD.description_event;
  NEW.meta_description_gen := OLD.meta_description_gen;

  RETURN NEW;
END;
$function$;
