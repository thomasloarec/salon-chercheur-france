CREATE OR REPLACE FUNCTION public.exposants_d_un_salon(
  p_salon text,
  p_sous_secteur text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_id uuid; v_nom text; v_slug text; v_ville text; v_date date; v_avenir boolean;
  v_result jsonb;
BEGIN
  -- Résolution du salon : slug exact prioritaire, sinon nom approché ; édition à venir prioritaire, sinon la plus récente
  SELECT e.id, e.nom_event, e.slug, e.ville, e.date_debut, (e.date_debut >= current_date)
    INTO v_id, v_nom, v_slug, v_ville, v_date, v_avenir
  FROM events e
  WHERE (lower(e.slug) = lower(p_salon) OR e.nom_event ILIKE '%'||p_salon||'%')
    AND e.visible = true AND COALESCE(e.is_test,false) = false
  ORDER BY (lower(e.slug) = lower(p_salon)) DESC, (e.date_debut >= current_date) DESC, e.date_debut DESC
  LIMIT 1;

  IF v_id IS NULL THEN
    RETURN jsonb_build_object('erreur','salon_introuvable','salon_demande',p_salon);
  END IF;

  -- MODE DRILL-DOWN : exposants d'un sous-secteur précis à ce salon
  IF p_sous_secteur IS NOT NULL AND length(trim(p_sous_secteur)) > 0 THEN
    SELECT jsonb_build_object(
      'salon', jsonb_build_object('nom',v_nom,'slug',v_slug,'ville',v_ville,'date_debut',v_date,'a_venir',v_avenir),
      'sous_secteur', p_sous_secteur,
      'nb_exposants', count(DISTINCT p.id_exposant),
      'exposants', COALESCE(jsonb_agg(DISTINCT jsonb_build_object('nom', old.nom_exposant, 'stand', p.stand_exposant))
                     FILTER (WHERE old.nom_exposant IS NOT NULL), '[]'::jsonb)
    ) INTO v_result
    FROM participation p
    JOIN exhibitor_sub_sectors ess ON ess.exhibitor_id = p.id_exposant
    JOIN sub_sectors ss ON ss.id = ess.sub_sector_id AND ss.name ILIKE '%'||p_sous_secteur||'%'
    LEFT JOIN exposants old ON old.id_exposant = p.id_exposant
    WHERE p.id_event = v_id;
    RETURN v_result;
  END IF;

  -- MODE APERÇU : macro + sous-secteurs + total + échantillon
  SELECT jsonb_build_object(
    'salon', jsonb_build_object('nom',v_nom,'slug',v_slug,'ville',v_ville,'date_debut',v_date,'a_venir',v_avenir),
    'nb_exposants', (SELECT count(DISTINCT p.id_exposant) FROM participation p WHERE p.id_event = v_id),
    'categories_macro', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('macro',macro,'nb',nb) ORDER BY nb DESC),'[]'::jsonb)
      FROM (
        SELECT s.name AS macro, count(DISTINCT p.id_exposant) AS nb
        FROM participation p
        JOIN exhibitor_ai ai ON ai.exhibitor_id = p.id_exposant
        JOIN sectors s ON s.id = ai.secteur_id
        WHERE p.id_event = v_id
        GROUP BY s.name
      ) a
    ),
    'categories_sous_secteurs', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('sous_secteur',ss_name,'nb',nb) ORDER BY nb DESC),'[]'::jsonb)
      FROM (
        SELECT ss.name AS ss_name, count(DISTINCT ess.exhibitor_id) AS nb
        FROM participation p
        JOIN exhibitor_sub_sectors ess ON ess.exhibitor_id = p.id_exposant
        JOIN sub_sectors ss ON ss.id = ess.sub_sector_id
        WHERE p.id_event = v_id
        GROUP BY ss.name ORDER BY nb DESC LIMIT 20
      ) b
    ),
    'echantillon_exposants', (
      SELECT COALESCE(jsonb_agg(nom ORDER BY nom),'[]'::jsonb)
      FROM (
        SELECT DISTINCT old.nom_exposant AS nom
        FROM participation p JOIN exposants old ON old.id_exposant = p.id_exposant
        WHERE p.id_event = v_id AND old.nom_exposant IS NOT NULL
        LIMIT 15
      ) c
    )
  ) INTO v_result;
  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.exposants_d_un_salon(text,text) TO service_role;