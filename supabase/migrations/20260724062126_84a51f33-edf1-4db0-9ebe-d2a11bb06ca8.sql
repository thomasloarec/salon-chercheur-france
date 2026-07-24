CREATE OR REPLACE FUNCTION public.get_novelty_ai_context(
  p_exhibitor_id uuid,
  p_event_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_exh jsonb; v_ai jsonb; v_ev jsonb; v_quota jsonb;
BEGIN
  SELECT jsonb_build_object(
           'nom', e.name, 'site', e.website,
           'description_actuelle', left(coalesce(e.description, ''), 800)
         )
  INTO v_exh FROM exhibitors e WHERE e.id = p_exhibitor_id;

  IF v_exh IS NULL THEN
    RETURN jsonb_build_object('erreur', 'exposant_introuvable');
  END IF;

  SELECT jsonb_build_object(
           'secteur', ai.secteur_principal,
           'sous_secteurs', ai.sous_secteurs,
           'produits_services', ai.produits_services,
           'mots_cles_metier', ai.mots_cles_metier,
           'profils_visiteurs', ai.profils_visiteurs,
           'resume', ai.resume_court
         )
  INTO v_ai
  FROM participation p
  JOIN exhibitor_ai ai ON ai.exhibitor_id = p.id_exposant
  WHERE p.exhibitor_id = p_exhibitor_id
  LIMIT 1;

  SELECT jsonb_build_object(
           'nom', ev.nom_event, 'ville', ev.ville,
           'date_debut', ev.date_debut, 'date_fin', ev.date_fin,
           'a_venir', (ev.date_debut >= current_date),
           'jours_avant', (ev.date_debut - current_date),
           'secteur', ev.secteur,
           'stand', (SELECT p2.stand_exposant FROM participation p2
                     WHERE p2.exhibitor_id = p_exhibitor_id AND p2.id_event = p_event_id
                     LIMIT 1)
         )
  INTO v_ev FROM events ev WHERE ev.id = p_event_id;

  IF v_ev IS NULL THEN
    RETURN jsonb_build_object('erreur', 'salon_introuvable');
  END IF;

  v_quota := public.novelty_quota_status(p_exhibitor_id, p_event_id);

  RETURN jsonb_build_object(
    'exposant', v_exh,
    'contexte_enrichi', v_ai,
    'salon', v_ev,
    'quota', v_quota
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_novelty_ai_context(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_novelty_ai_context(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_novelty_ai_context(uuid, uuid) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.get_novelty_ai_context(uuid, uuid) TO service_role, postgres;

COMMENT ON FUNCTION public.get_novelty_ai_context IS
  'Contexte de génération assistée d''une Nouveauté. Réservé au service_role : contient le quota et la description interne de l''exposant.';