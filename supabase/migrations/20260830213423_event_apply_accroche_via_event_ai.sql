-- Correction : la "phrase de presentation" affichee = event_ai.accroche (pas meta_description_gen).
-- admin_apply_event_change applique desormais accroche via un upsert dans event_ai (event_id UNIQUE),
-- avec garde-fou dur a 160 caracteres. Retrait total du traitement meta_description_gen.
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

  -- Garde-fou dur : phrase de presentation (accroche) plafonnee a 160 caracteres.
  IF pc ? 'accroche' AND length(pc->>'accroche') > 160 THEN
    RAISE EXCEPTION 'accroche dépasse 160 caractères (% caractères)', length(pc->>'accroche');
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
    updated_at        = now()
  WHERE e.id = v_event_id;

  -- Phrase de presentation courte = event_ai.accroche (table d'enrichissement, event_id UNIQUE).
  IF pc ? 'accroche' THEN
    INSERT INTO public.event_ai (event_id, accroche, updated_at)
    VALUES (v_event_id, pc->>'accroche', now())
    ON CONFLICT (event_id) DO UPDATE
      SET accroche = EXCLUDED.accroche, updated_at = now();
  END IF;

  UPDATE public.event_change_requests SET
    status = 'approved', reviewed_by = p_admin_user_id,
    reviewed_at = now(), applied_at = now()
  WHERE id = p_request_id;

  RETURN v_event_id;
END;
$function$;
