CREATE OR REPLACE FUNCTION public.nouveautes_d_un_salon(
  p_salon text,
  p_type  text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_id uuid; v_nom text; v_slug text; v_ville text; v_date date; v_avenir boolean;
  v_type text;
  v_total int;
  v_annonces jsonb;
  c_plafond constant int := 15;
BEGIN
  SELECT e.id, e.nom_event, e.slug, e.ville, e.date_debut, (e.date_debut >= current_date)
    INTO v_id, v_nom, v_slug, v_ville, v_date, v_avenir
  FROM events e
  WHERE (lower(e.slug) = lower(p_salon) OR e.nom_event ILIKE '%'||p_salon||'%')
    AND e.visible = true AND COALESCE(e.is_test, false) = false
  ORDER BY (lower(e.slug) = lower(p_salon)) DESC,
           (e.date_debut >= current_date) DESC,
           e.date_debut DESC
  LIMIT 1;

  IF v_id IS NULL THEN
    RETURN jsonb_build_object('erreur', 'salon_introuvable', 'salon_demande', p_salon);
  END IF;

  v_type := nullif(trim(coalesce(p_type, '')), '');
  IF v_type IS NOT NULL
     AND v_type NOT IN ('Launch','Update','Demo','Special_Offer','Partnership','Innovation') THEN
    RETURN jsonb_build_object(
      'erreur', 'type_invalide',
      'type_demande', p_type,
      'types_valides', jsonb_build_array('Launch','Update','Demo','Special_Offer','Partnership','Innovation')
    );
  END IF;

  SELECT count(*) INTO v_total
  FROM public_novelties pn
  WHERE pn.event_id = v_id
    AND (v_type IS NULL OR pn.type = v_type);

  SELECT COALESCE(jsonb_agg(a ORDER BY a->>'publiee_le' DESC), '[]'::jsonb)
  INTO v_annonces
  FROM (
    SELECT jsonb_build_object(
             'titre',           pn.title,
             'type',            pn.type,
             'exposant',        pn.exhibitor_display_name,
             'exposant_slug',   pn.exhibitor_public_slug,
             'nouveaute_slug',  pn.slug,
             'resume',          left(COALESCE(nullif(trim(pn.summary), ''), pn.reason_1), 300),
             'a_un_document',   (pn.doc_url IS NOT NULL OR pn.resource_url IS NOT NULL),
             'publiee_le',      pn.created_at
           ) AS a
    FROM public_novelties pn
    WHERE pn.event_id = v_id
      AND (v_type IS NULL OR pn.type = v_type)
    ORDER BY pn.created_at DESC
    LIMIT c_plafond
  ) s;

  RETURN jsonb_build_object(
    'salon', jsonb_build_object(
      'nom', v_nom, 'slug', v_slug, 'ville', v_ville,
      'date_debut', v_date, 'a_venir', v_avenir
    ),
    'type_filtre',     v_type,
    'nb_annonces',     v_total,
    'plafond_atteint', (v_total > c_plafond),
    'annonces',        v_annonces,
    'note', CASE
      WHEN v_total = 0 THEN
        'Aucun exposant de ce salon n''a encore publié d''annonce sur Lotexpo. '
        || 'Cela ne signifie PAS qu''il ne s''y passe rien : la publication est volontaire et '
        || 'très peu d''exposants l''ont faite à ce jour. Ne conclus rien sur le contenu du salon '
        || 'à partir de cette absence, et oriente vers la liste des exposants.'
      ELSE
        'Liste déclarative et très partielle : seule une petite minorité d''exposants publie une annonce. '
        || 'Cite ces annonces individuellement en nommant l''exposant. N''en déduis JAMAIS les tendances, '
        || 'les thèmes dominants ni l''orientation du salon, et ne les présente pas comme représentatives '
        || 'de ce qui sera exposé.'
    END,
    'page_salon', '/events/'||v_slug
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.nouveautes_d_un_salon(text, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.nouveautes_d_un_salon(text, text)
  TO anon, authenticated, service_role, postgres;

COMMENT ON FUNCTION public.nouveautes_d_un_salon IS
  'Inventaire des Nouveautés publiées d''un salon. Lignes individuelles et total brut uniquement : aucun agrégat thématique, aucun nombre d''exposants, aucun signal commercial. Complète match_novelties_semantic, qui ne sait pas énumérer.';