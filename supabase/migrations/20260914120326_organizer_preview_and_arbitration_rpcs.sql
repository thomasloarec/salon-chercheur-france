-- Lot 4 — Apercu, arbitrage et decision. Aucune ecriture hors staging.

-- ============================================================
-- 1. Apercu complet d'un import
-- ============================================================
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
  -- Participations existantes non couvertes par le fichier : les retraits candidats.
  -- Une ligne en arbitrage NON tranchee protege la participation qu'elle pourrait designer :
  -- on ne retire jamais sur la base d'un rapprochement incertain.
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

COMMENT ON FUNCTION public.organizer_preview_exhibitor_list(uuid) IS
  'Apercu avant application : compteurs, lignes a arbitrer, changements de stand, participations absentes du fichier. Lecture seule. Une ligne en arbitrage non tranchee protege la participation qu''elle pourrait designer, pour ne jamais retirer sur un rapprochement incertain.';

-- ============================================================
-- 2. Candidats d'une ligne a arbitrer
-- Renvoie TOUS les candidats au meilleur score, pas seulement le premier.
-- ============================================================
CREATE OR REPLACE FUNCTION public.organizer_line_candidates(p_line_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_l      staging_organizer_exhibitors;
  v_event  uuid;
  v_res    jsonb;
BEGIN
  IF NOT (public.is_admin() OR COALESCE(auth.role(), '') = 'service_role') THEN
    RAISE EXCEPTION 'organizer_line_candidates: admin ou service_role uniquement';
  END IF;

  SELECT * INTO v_l FROM staging_organizer_exhibitors WHERE id = p_line_id;
  IF v_l.id IS NULL THEN
    RAISE EXCEPTION 'organizer_line_candidates: ligne introuvable';
  END IF;
  v_event := v_l.event_id;

  WITH par_domaine AS (
    SELECT e.id_exposant, 'domaine' AS origine,
           CASE WHEN normalize_domain(e.website_exposant) = v_l.domain_full THEN 100 ELSE 85 END AS score
    FROM exposants e
    WHERE e.is_canonical
      AND (normalize_domain(e.website_exposant) = v_l.domain_full
           OR (v_l.domain_registrable IS NOT NULL
               AND registrable_domain(e.website_exposant) = v_l.domain_registrable))
  ),
  scores_nom AS (
    SELECT e.id_exposant,
           word_similarity(v_l.nom_normalized, lower(e.nom_exposant)) AS sim
    FROM exposants e
    WHERE e.is_canonical
      AND v_l.nom_normalized IS NOT NULL
      AND word_similarity(v_l.nom_normalized, lower(e.nom_exposant)) >= 0.70
  ),
  -- Tous les ex aequo au meilleur score, jamais un seul arbitrairement
  par_nom AS (
    SELECT id_exposant, 'nom' AS origine, round(sim * 100)::int AS score
    FROM scores_nom
    WHERE sim >= (SELECT max(sim) FROM scores_nom)
  ),
  par_id AS (
    SELECT COALESCE(c.id_exposant, e.id_exposant) AS id_exposant, 'identifiant saisi' AS origine, 100 AS score
    FROM exposants e LEFT JOIN exposants c ON c.id = e.canonical_id
    WHERE e.id_exposant = v_l.raw_id_exposant
  ),
  tous AS (
    SELECT * FROM par_domaine UNION ALL SELECT * FROM par_nom UNION ALL SELECT * FROM par_id
  ),
  dedup AS (
    SELECT id_exposant, string_agg(DISTINCT origine, ', ') AS origines, max(score) AS score
    FROM tous GROUP BY id_exposant
  )
  SELECT jsonb_build_object(
    'ligne', jsonb_build_object(
      'id', v_l.id, 'line_no', v_l.line_no, 'nom', v_l.raw_nom, 'stand', v_l.raw_stand,
      'website', v_l.raw_website, 'domaine', v_l.domain_registrable,
      'id_saisi', v_l.raw_id_exposant, 'match_kind', v_l.match_kind, 'raison', v_l.match_reason),
    'candidats', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id_exposant', d.id_exposant,
        'nom', e.nom_exposant,
        'website', e.website_exposant,
        'origines', d.origines,
        'score', d.score,
        'deja_sur_ce_salon', EXISTS (
          SELECT 1 FROM participation p
          WHERE p.id_event = v_event AND p.id_exposant = d.id_exposant),
        'nb_participations', (SELECT count(*) FROM participation p WHERE p.id_exposant = d.id_exposant)
      ) ORDER BY d.score DESC, e.nom_exposant)
      FROM dedup d JOIN exposants e ON e.id_exposant = d.id_exposant), '[]'::jsonb)
  ) INTO v_res;

  RETURN v_res;
END;
$$;

COMMENT ON FUNCTION public.organizer_line_candidates(uuid) IS
  'Candidats d''une ligne a arbitrer. Renvoie TOUS les ex aequo au meilleur score du nom, jamais un seul choisi arbitrairement, pour ne pas faire arbitrer sur une liste tronquee.';

-- ============================================================
-- 3. Enregistrement d'une decision d'arbitrage
-- ============================================================
CREATE OR REPLACE FUNCTION public.organizer_decide_line(
  p_line_id     uuid,
  p_decision    text,               -- 'lier' | 'creer' | 'ignorer'
  p_id_exposant text DEFAULT NULL   -- requis si p_decision = 'lier'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_l        staging_organizer_exhibitors;
  v_action   text;
  v_stand    text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'organizer_decide_line: admin uniquement';
  END IF;

  SELECT * INTO v_l FROM staging_organizer_exhibitors WHERE id = p_line_id;
  IF v_l.id IS NULL THEN
    RAISE EXCEPTION 'organizer_decide_line: ligne introuvable';
  END IF;

  IF EXISTS (SELECT 1 FROM organizer_exhibitor_imports
             WHERE id = v_l.import_id AND status = 'applied') THEN
    RAISE EXCEPTION 'organizer_decide_line: import deja applique';
  END IF;

  IF p_decision = 'ignorer' THEN
    UPDATE staging_organizer_exhibitors
    SET match_kind = 'ignored', planned_action = 'ignore',
        matched_id_exposant = NULL,
        match_reason = 'ignoree par decision admin',
        decided_by = auth.uid(), decided_at = now()
    WHERE id = p_line_id;
    RETURN jsonb_build_object('decision', 'ignorer');

  ELSIF p_decision = 'creer' THEN
    IF v_l.domain_full IS NULL THEN
      RAISE EXCEPTION 'organizer_decide_line: creation impossible sans site web exploitable';
    END IF;
    UPDATE staging_organizer_exhibitors
    SET match_kind = 'to_create', planned_action = 'create',
        matched_id_exposant = NULL, match_score = 0,
        match_reason = 'creation confirmee par decision admin',
        decided_by = auth.uid(), decided_at = now()
    WHERE id = p_line_id;
    RETURN jsonb_build_object('decision', 'creer');

  ELSIF p_decision = 'lier' THEN
    IF p_id_exposant IS NULL THEN
      RAISE EXCEPTION 'organizer_decide_line: p_id_exposant requis pour lier';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM exposants WHERE id_exposant = p_id_exposant AND is_canonical) THEN
      RAISE EXCEPTION 'organizer_decide_line: % inconnu ou non canonique', p_id_exposant;
    END IF;

    SELECT p.stand_exposant INTO v_stand
    FROM participation p
    WHERE p.id_event = v_l.event_id AND p.id_exposant = p_id_exposant;

    v_action := CASE
      WHEN NOT FOUND THEN 'create'
      WHEN COALESCE(v_stand, '') IS DISTINCT FROM COALESCE(v_l.raw_stand, '') THEN 'update_stand'
      ELSE 'unchanged' END;

    UPDATE staging_organizer_exhibitors
    SET match_kind = 'supplied_id', matched_id_exposant = p_id_exposant,
        match_score = 100, planned_action = v_action,
        match_reason = 'liaison confirmee par decision admin',
        decided_by = auth.uid(), decided_at = now()
    WHERE id = p_line_id;
    RETURN jsonb_build_object('decision', 'lier', 'action', v_action);

  ELSE
    RAISE EXCEPTION 'organizer_decide_line: decision invalide (lier, creer ou ignorer)';
  END IF;
END;
$$;

COMMENT ON FUNCTION public.organizer_decide_line(uuid, text, text) IS
  'Enregistre l''arbitrage d''une ligne : lier a un exposant existant, creer, ou ignorer. Trace decided_by et decided_at. Refuse si l''import est deja applique.';

REVOKE EXECUTE ON FUNCTION public.organizer_preview_exhibitor_list(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.organizer_line_candidates(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.organizer_decide_line(uuid, text, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.organizer_preview_exhibitor_list(uuid) TO authenticated, service_role;
GRANT  EXECUTE ON FUNCTION public.organizer_line_candidates(uuid) TO authenticated, service_role;
GRANT  EXECUTE ON FUNCTION public.organizer_decide_line(uuid, text, text) TO authenticated, service_role;
