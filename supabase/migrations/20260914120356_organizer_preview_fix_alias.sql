-- Correctif : dans organizer_preview_exhibitor_list, la CTE "absents" etait referencee
-- via l'alias "a" sans que cet alias soit declare (FROM absents au lieu de FROM absents a).
--
-- Comme pour le correctif pg_trgm du lot 3, l'erreur ne se produisait PAS a la creation
-- de la fonction mais a son execution. La migration passait, la fonction etait cassee.
-- Seul un appel reel le revele.
--
-- Le corps complet est redonne ici, CREATE OR REPLACE ne permettant pas de patch partiel.

CREATE OR REPLACE FUNCTION public.organizer_preview_exhibitor_list(p_import_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id uuid;
  v_res      jsonb;
BEGIN
  IF NOT (public.is_admin() OR COALESCE(auth.role(), '') = 'service_role') THEN
    RAISE EXCEPTION 'organizer_preview_exhibitor_list: admin ou service_role uniquement';
  END IF;

  SELECT event_id INTO v_event_id FROM organizer_exhibitor_imports WHERE id = p_import_id;
  IF v_event_id IS NULL THEN
    RAISE EXCEPTION 'organizer_preview_exhibitor_list: import % introuvable', p_import_id;
  END IF;

  WITH lignes AS (
    SELECT * FROM staging_organizer_exhibitors WHERE import_id = p_import_id
  ),
  couverts AS (
    SELECT DISTINCT matched_id_exposant AS id_exposant
    FROM lignes WHERE matched_id_exposant IS NOT NULL
    UNION
    SELECT DISTINCT domain_id_exposant FROM lignes WHERE domain_id_exposant IS NOT NULL
  ),
  absents AS (
    SELECT p.id_participation, p.id_exposant, p.stand_exposant,
           e.nom_exposant, registrable_domain(p.website_exposant) AS domaine
    FROM participation p
    LEFT JOIN exposants e ON e.id_exposant = p.id_exposant
    WHERE p.id_event = v_event_id
      AND p.id_exposant NOT IN (SELECT id_exposant FROM couverts)
  )
  SELECT jsonb_build_object(
    'import_id', p_import_id,
    'event', (SELECT jsonb_build_object('id', id, 'nom_event', nom_event, 'date_debut', date_debut)
              FROM events WHERE id = v_event_id),
    'compteurs', jsonb_build_object(
      'lignes_fichier',           (SELECT count(*) FROM lignes),
      'participations_actuelles', (SELECT count(*) FROM participation WHERE id_event = v_event_id),
      'create',                   (SELECT count(*) FROM lignes WHERE planned_action = 'create'),
      'update_stand',             (SELECT count(*) FROM lignes WHERE planned_action = 'update_stand'),
      'unchanged',                (SELECT count(*) FROM lignes WHERE planned_action = 'unchanged'),
      'review',                   (SELECT count(*) FROM lignes WHERE planned_action = 'review'),
      'ignore',                   (SELECT count(*) FROM lignes WHERE planned_action = 'ignore'),
      'retraits',                 (SELECT count(*) FROM absents)
    ),
    'a_arbitrer', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', l.id, 'line_no', l.line_no, 'nom', l.raw_nom, 'stand', l.raw_stand,
        'website', l.raw_website, 'domaine', l.domain_registrable,
        'match_kind', l.match_kind, 'raison', l.match_reason,
        'id_saisi', l.raw_id_exposant,
        'candidat_propose', l.matched_id_exposant,
        'candidat_concurrent', l.domain_id_exposant
      ) ORDER BY l.line_no)
      FROM lignes l WHERE l.planned_action = 'review'), '[]'::jsonb),
    'changements_stand', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'line_no', l.line_no, 'nom', l.raw_nom,
        'stand_avant', p.stand_exposant, 'stand_apres', l.raw_stand
      ) ORDER BY l.line_no)
      FROM lignes l
      JOIN participation p ON p.id_event = v_event_id AND p.id_exposant = l.matched_id_exposant
      WHERE l.planned_action = 'update_stand'), '[]'::jsonb),
    'retraits', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id_participation', a.id_participation, 'nom', a.nom_exposant,
        'stand', a.stand_exposant, 'domaine', a.domaine
      ) ORDER BY a.nom_exposant) FROM absents a), '[]'::jsonb)
  ) INTO v_res;

  RETURN v_res;
END;
$$;
