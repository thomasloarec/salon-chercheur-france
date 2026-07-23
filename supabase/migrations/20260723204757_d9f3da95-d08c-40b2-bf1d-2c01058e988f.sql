CREATE OR REPLACE FUNCTION public.exposants_d_un_salon(
  p_salon text,
  p_sous_secteur text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_id uuid; v_nom text; v_slug text; v_ville text; v_date date; v_avenir boolean;
  v_n int;
  v_couverture text;
  v_note text;
  v_result jsonb;
BEGIN
  SELECT e.id, e.nom_event, e.slug, e.ville, e.date_debut, (e.date_debut >= current_date)
    INTO v_id, v_nom, v_slug, v_ville, v_date, v_avenir
  FROM events e
  WHERE (lower(e.slug) = lower(p_salon) OR e.nom_event ILIKE '%'||p_salon||'%')
    AND e.visible = true AND COALESCE(e.is_test,false) = false
  ORDER BY (lower(e.slug) = lower(p_salon)) DESC,
           (e.date_debut >= current_date) DESC,
           e.date_debut DESC
  LIMIT 1;

  IF v_id IS NULL THEN
    RETURN jsonb_build_object('erreur','salon_introuvable','salon_demande',p_salon);
  END IF;

  SELECT count(DISTINCT p.id_exposant) INTO v_n
  FROM participation p WHERE p.id_event = v_id;

  v_couverture := CASE
    WHEN v_n = 0  THEN 'aucune'
    WHEN v_n < 10 THEN 'tres_partielle'
    WHEN v_n < 30 THEN 'partielle'
    ELSE 'referencee'
  END;

  v_note := CASE v_couverture
    WHEN 'aucune' THEN
      'Aucun exposant de ce salon n''est référencé sur Lotexpo. Cela ne signifie PAS que ce salon '
      || 'n''a pas d''exposants : sa liste n''a simplement pas encore été collectée. Ne dis JAMAIS '
      || 'que ce salon n''a pas d''exposants. Explique que la liste n''est pas encore disponible et '
      || 'renvoie vers la page du salon.'
    WHEN 'tres_partielle' THEN
      format('Seuls %s exposants de ce salon sont référencés sur Lotexpo, très en dessous de la réalité. '
      || 'Ce nombre ne représente PAS la taille du salon et ne doit jamais être présenté comme telle. '
      || 'Les répartitions par catégorie ont été volontairement retirées : elles seraient trompeuses '
      || 'sur un échantillon aussi faible. Tu peux citer les exposants connus, mais ne caractérise ni '
      || 'la taille ni les thèmes de ce salon.', v_n)
    WHEN 'partielle' THEN
      format('%s exposants de ce salon sont référencés sur Lotexpo. La couverture est partielle : ce '
      || 'nombre est un plancher, pas la taille du salon. Les répartitions ci-dessous décrivent les '
      || 'exposants référencés, pas le salon lui-même. Formule toujours "%s exposants référencés sur '
      || 'Lotexpo", jamais "le salon compte %s exposants".', v_n, v_n, v_n)
    ELSE
      format('%s exposants de ce salon sont référencés sur Lotexpo. Formule toujours "%s exposants '
      || 'référencés sur Lotexpo", jamais "le salon compte %s exposants" : la couverture peut rester '
      || 'incomplète.', v_n, v_n, v_n)
  END;

  IF p_sous_secteur IS NOT NULL AND length(trim(p_sous_secteur)) > 0 THEN
    RETURN jsonb_build_object(
      'salon', jsonb_build_object('nom',v_nom,'slug',v_slug,'ville',v_ville,'date_debut',v_date,'a_venir',v_avenir),
      'sous_secteur', p_sous_secteur,
      'couverture_salon', v_couverture,
      'nb_exposants_total', (
        SELECT count(DISTINCT p.id_exposant)
        FROM participation p
        JOIN exhibitor_sub_sectors ess ON ess.exhibitor_id = p.id_exposant
        JOIN sub_sectors ss ON ss.id = ess.sub_sector_id AND ss.name ILIKE '%'||p_sous_secteur||'%'
        WHERE p.id_event = v_id
      ),
      'apercu_exposants', (
        SELECT COALESCE(jsonb_agg(jsonb_build_object('nom', nom, 'public_slug', public_slug)), '[]'::jsonb)
        FROM (
          SELECT DISTINCT COALESCE(old.nom_exposant, epi.canonical_name) AS nom, epi.public_slug
          FROM participation p
          JOIN exhibitor_sub_sectors ess ON ess.exhibitor_id = p.id_exposant
          JOIN sub_sectors ss ON ss.id = ess.sub_sector_id AND ss.name ILIKE '%'||p_sous_secteur||'%'
          LEFT JOIN exposants old ON old.id_exposant = p.id_exposant
          LEFT JOIN exhibitor_public_identities epi ON epi.legacy_exposant_id = p.id_exposant AND epi.is_active = true
          WHERE p.id_event = v_id AND COALESCE(old.nom_exposant, epi.canonical_name) IS NOT NULL
          ORDER BY nom
          LIMIT 10
        ) t
      ),
      'note', 'apercu_exposants est un échantillon plafonné, PAS la liste complète. ' || v_note,
      'page_salon', '/events/'||v_slug
    );
  END IF;

  SELECT jsonb_build_object(
    'salon', jsonb_build_object('nom',v_nom,'slug',v_slug,'ville',v_ville,'date_debut',v_date,'a_venir',v_avenir),
    'nb_exposants', v_n,
    'couverture', v_couverture,
    'note', v_note,
    'categories_macro', CASE WHEN v_couverture IN ('aucune','tres_partielle') THEN '[]'::jsonb ELSE (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('macro',macro,'nb',nb) ORDER BY nb DESC),'[]'::jsonb)
      FROM (SELECT s.name AS macro, count(DISTINCT p.id_exposant) AS nb
            FROM participation p JOIN exhibitor_ai ai ON ai.exhibitor_id = p.id_exposant
            JOIN sectors s ON s.id = ai.secteur_id WHERE p.id_event = v_id GROUP BY s.name) a
    ) END,
    'categories_sous_secteurs', CASE WHEN v_couverture IN ('aucune','tres_partielle') THEN '[]'::jsonb ELSE (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('sous_secteur',ss_name,'nb',nb) ORDER BY nb DESC),'[]'::jsonb)
      FROM (SELECT ss.name AS ss_name, count(DISTINCT ess.exhibitor_id) AS nb
            FROM participation p JOIN exhibitor_sub_sectors ess ON ess.exhibitor_id = p.id_exposant
            JOIN sub_sectors ss ON ss.id = ess.sub_sector_id WHERE p.id_event = v_id
            GROUP BY ss.name ORDER BY nb DESC LIMIT 20) b
    ) END,
    'echantillon_exposants', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('nom', nom, 'public_slug', public_slug)), '[]'::jsonb)
      FROM (SELECT DISTINCT COALESCE(old.nom_exposant, epi.canonical_name) AS nom, epi.public_slug
            FROM participation p
            LEFT JOIN exposants old ON old.id_exposant = p.id_exposant
            LEFT JOIN exhibitor_public_identities epi ON epi.legacy_exposant_id = p.id_exposant AND epi.is_active = true
            WHERE p.id_event = v_id AND COALESCE(old.nom_exposant, epi.canonical_name) IS NOT NULL
            LIMIT 8) c
    ),
    'page_salon', '/events/'||v_slug
  ) INTO v_result;

  RETURN v_result;
END;
$function$;