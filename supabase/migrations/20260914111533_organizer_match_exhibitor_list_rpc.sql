-- Lot 3 — Rapprochement des lignes d'un fichier organisateur avec l'existant.
--
-- Principe : l'id_exposant saisi manuellement fait autorite, MAIS il est systematiquement
-- confronte a deux contre-expertises independantes, le domaine ET le nom.
-- Un desaccord n'est jamais absorbe en silence : il devient un id_conflict a arbitrer.
--
-- Motif : le rapprochement dans Airtable est fait a la main. Le fichier Solucop Lille du
-- 14/09 contenait 4 entreprises deja presentes en base sous un domaine different
-- (SAINT GOBAIN WEBER, ACCEO, BATISANTE, SICAME). Le controle par domaine seul ne pouvait
-- pas les voir. Sans la contre-expertise par le nom, elles auraient ete dupliquees.

CREATE OR REPLACE FUNCTION public.organizer_match_exhibitor_list(
  p_import_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id uuid;
  v_stats    jsonb;
  -- Seuils. Le seuil de conflit est plus haut que le seuil de suggestion :
  -- on ne contredit une saisie humaine que sur une ressemblance forte.
  c_seuil_conflit   constant real := 0.85;
  c_seuil_suggestion constant real := 0.70;
BEGIN
  IF NOT (public.is_admin() OR COALESCE(auth.role(), '') = 'service_role') THEN
    RAISE EXCEPTION 'organizer_match_exhibitor_list: admin ou service_role uniquement';
  END IF;

  SELECT event_id INTO v_event_id
  FROM organizer_exhibitor_imports WHERE id = p_import_id;

  IF v_event_id IS NULL THEN
    RAISE EXCEPTION 'organizer_match_exhibitor_list: import % introuvable', p_import_id;
  END IF;

  -- Remise a zero : le rapprochement est rejouable a volonte.
  UPDATE staging_organizer_exhibitors
  SET match_kind = 'pending', matched_id_exposant = NULL, match_score = NULL,
      domain_id_exposant = NULL, planned_action = NULL,
      match_reason = CASE WHEN parse_flag = 'ok' THEN NULL ELSE match_reason END
  WHERE import_id = p_import_id;

  -- ============================================================
  -- 1. Lignes ecartees d'office par le nettoyage
  -- ============================================================
  UPDATE staging_organizer_exhibitors
  SET match_kind = 'ignored', planned_action = 'ignore'
  WHERE import_id = p_import_id
    AND parse_flag IN ('duplicate_line', 'missing_name');

  UPDATE staging_organizer_exhibitors
  SET match_kind = 'ambiguous', planned_action = 'review',
      match_reason = COALESCE(match_reason, 'site web inutilisable, saisie manuelle requise')
  WHERE import_id = p_import_id
    AND parse_flag IN ('invalid_url', 'platform_url', 'missing_website');

  -- ============================================================
  -- 2. Candidats, calcules pour TOUTES les lignes encore en jeu
  -- ============================================================
  CREATE TEMP TABLE _cand ON COMMIT DROP AS
  WITH lignes AS (
    SELECT s.id, s.line_no, s.raw_id_exposant, s.nom_normalized,
           s.domain_full, s.domain_registrable, s.raw_stand, s.parse_flag
    FROM staging_organizer_exhibitors s
    WHERE s.import_id = p_import_id
      AND s.match_kind = 'pending'
  ),
  -- Identifiant saisi, redirige vers son canonique s'il s'agit d'une variante
  par_id AS (
    SELECT l.id,
           COALESCE(c.id_exposant, e.id_exposant) AS id_resolu,
           (e.is_canonical = false) AS etait_variante
    FROM lignes l
    LEFT JOIN exposants e ON e.id_exposant = l.raw_id_exposant
    LEFT JOIN exposants c ON c.id = e.canonical_id
  ),
  -- Niveau 1 : domaine complet contre le referentiel exposants
  par_dom1 AS (
    SELECT l.id, min(e.id_exposant) AS cand, count(*) AS n
    FROM lignes l
    JOIN exposants e ON e.is_canonical
                    AND normalize_domain(e.website_exposant) = l.domain_full
    GROUP BY l.id
  ),
  -- Niveau 2 : domaine complet contre les participations du salon
  par_dom2 AS (
    SELECT l.id, min(p.id_exposant) AS cand, count(*) AS n
    FROM lignes l
    JOIN participation p ON p.id_event = v_event_id
                        AND normalize_domain(p.website_exposant) = l.domain_full
    GROUP BY l.id
  ),
  -- Niveau 3 : domaine enregistrable, cote referentiel et cote salon
  par_dom3 AS (
    SELECT l.id, min(e.id_exposant) AS cand, count(*) AS n
    FROM lignes l
    JOIN exposants e ON e.is_canonical
                    AND registrable_domain(e.website_exposant) = l.domain_registrable
    WHERE l.domain_registrable IS NOT NULL
    GROUP BY l.id
  ),
  -- Niveau 4 : meilleur voisin par le nom
  par_nom AS (
    SELECT l.id, x.id_exposant AS cand, x.sim
    FROM lignes l
    JOIN LATERAL (
      SELECT e.id_exposant,
             word_similarity(l.nom_normalized, lower(e.nom_exposant)) AS sim
      FROM exposants e
      WHERE e.is_canonical
        AND l.nom_normalized IS NOT NULL
        AND word_similarity(l.nom_normalized, lower(e.nom_exposant)) >= c_seuil_suggestion
      ORDER BY 2 DESC, e.id_exposant
      LIMIT 1
    ) x ON true
  )
  SELECT l.id, l.parse_flag, l.raw_id_exposant, l.raw_stand,
         i.id_resolu, i.etait_variante,
         d1.cand AS dom1, d1.n AS dom1_n,
         d2.cand AS dom2, d2.n AS dom2_n,
         d3.cand AS dom3, d3.n AS dom3_n,
         nm.cand AS nom_cand, nm.sim AS nom_sim,
         COALESCE(d1.cand, d2.cand, d3.cand) AS dom_cand
  FROM lignes l
  LEFT JOIN par_id   i  ON i.id  = l.id
  LEFT JOIN par_dom1 d1 ON d1.id = l.id
  LEFT JOIN par_dom2 d2 ON d2.id = l.id
  LEFT JOIN par_dom3 d3 ON d3.id = l.id
  LEFT JOIN par_nom  nm ON nm.id = l.id;

  -- ============================================================
  -- 3. Arbitrage
  -- ============================================================

  -- 3a. Identifiant fourni ET contredit par le domaine ou par le nom
  UPDATE staging_organizer_exhibitors s
  SET match_kind = 'id_conflict',
      matched_id_exposant = c.id_resolu,
      domain_id_exposant = COALESCE(c.dom_cand, c.nom_cand),
      planned_action = 'review',
      match_reason = CASE
        WHEN c.dom_cand IS NOT NULL AND c.dom_cand IS DISTINCT FROM c.id_resolu
          THEN 'identifiant saisi ' || COALESCE(c.id_resolu, c.raw_id_exposant)
               || ', mais le domaine designe ' || c.dom_cand
        ELSE 'identifiant saisi ' || COALESCE(c.id_resolu, c.raw_id_exposant)
             || ', mais le nom ressemble a ' || c.nom_cand
             || ' (' || round(c.nom_sim::numeric, 2) || ')'
      END
  FROM _cand c
  WHERE s.id = c.id
    AND c.raw_id_exposant IS NOT NULL
    AND (
      (c.dom_cand IS NOT NULL AND c.dom_cand IS DISTINCT FROM c.id_resolu)
      OR (c.dom_cand IS NULL AND c.nom_cand IS NOT NULL
          AND c.nom_cand IS DISTINCT FROM c.id_resolu
          AND c.nom_sim >= c_seuil_conflit)
    );

  -- 3b. Identifiant fourni et confirme, ou non contredit
  UPDATE staging_organizer_exhibitors s
  SET match_kind = 'supplied_id',
      matched_id_exposant = COALESCE(c.id_resolu, s.raw_id_exposant),
      match_score = 100,
      match_reason = COALESCE(s.match_reason,
        CASE WHEN c.etait_variante THEN 'identifiant variante, redirige vers le canonique'
             WHEN c.id_resolu IS NULL THEN 'identifiant valide, fiche a creer a l''application'
             ELSE NULL END)
  FROM _cand c
  WHERE s.id = c.id
    AND s.match_kind = 'pending'
    AND c.raw_id_exposant IS NOT NULL;

  -- 3c. Cascade par domaine, sans identifiant fourni
  UPDATE staging_organizer_exhibitors s
  SET match_kind = CASE WHEN c.dom1 IS NOT NULL OR c.dom2 IS NOT NULL
                        THEN 'exact_domain' ELSE 'registrable_domain' END,
      matched_id_exposant = c.dom_cand,
      match_score = CASE WHEN c.dom1 IS NOT NULL THEN 100
                         WHEN c.dom2 IS NOT NULL THEN 95
                         ELSE 85 END
  FROM _cand c
  WHERE s.id = c.id
    AND s.match_kind = 'pending'
    AND c.dom_cand IS NOT NULL
    AND COALESCE(c.dom1_n, 1) = 1 AND COALESCE(c.dom3_n, 1) = 1;

  -- 3d. Plusieurs exposants sur le meme domaine : tranchage humain
  UPDATE staging_organizer_exhibitors s
  SET match_kind = 'ambiguous', planned_action = 'review',
      match_reason = 'plusieurs exposants partagent ce domaine'
  FROM _cand c
  WHERE s.id = c.id
    AND s.match_kind = 'pending'
    AND (c.dom1_n > 1 OR c.dom3_n > 1);

  -- 3e. Suggestion par le nom, toujours soumise a arbitrage
  UPDATE staging_organizer_exhibitors s
  SET match_kind = 'name_similarity',
      matched_id_exposant = c.nom_cand,
      match_score = round(c.nom_sim * 100)::int,
      planned_action = 'review',
      match_reason = 'aucun domaine correspondant, nom proche de ' || c.nom_cand
  FROM _cand c
  WHERE s.id = c.id
    AND s.match_kind = 'pending'
    AND c.nom_cand IS NOT NULL;

  -- 3f. Rien trouve : creation
  UPDATE staging_organizer_exhibitors s
  SET match_kind = 'to_create', match_score = 0
  WHERE s.import_id = p_import_id AND s.match_kind = 'pending';

  -- ============================================================
  -- 4. Action prevue, pour les lignes rapprochees automatiquement
  -- ============================================================
  UPDATE staging_organizer_exhibitors s
  SET planned_action = CASE
        WHEN p.id_participation IS NULL THEN 'create'
        WHEN COALESCE(p.stand_exposant, '') IS DISTINCT FROM COALESCE(s.raw_stand, '') THEN 'update_stand'
        ELSE 'unchanged'
      END
  FROM (SELECT * FROM staging_organizer_exhibitors WHERE import_id = p_import_id) s2
  LEFT JOIN participation p ON p.id_event = v_event_id
                           AND p.id_exposant = s2.matched_id_exposant
  WHERE s.id = s2.id
    AND s.planned_action IS NULL
    AND s.match_kind IN ('supplied_id','exact_domain','registrable_domain','to_create');

  -- ============================================================
  -- 5. Compteurs
  -- ============================================================
  SELECT jsonb_build_object(
           'par_match', COALESCE(jsonb_object_agg(match_kind, n), '{}'::jsonb),
           'par_action', (
             SELECT COALESCE(jsonb_object_agg(COALESCE(planned_action,'(aucune)'), na), '{}'::jsonb)
             FROM (SELECT planned_action, count(*) na
                   FROM staging_organizer_exhibitors
                   WHERE import_id = p_import_id GROUP BY 1) y
           )
         )
  INTO v_stats
  FROM (SELECT match_kind, count(*) n
        FROM staging_organizer_exhibitors
        WHERE import_id = p_import_id GROUP BY 1) z;

  UPDATE organizer_exhibitor_imports
  SET status = 'matched', matched_at = now(),
      stats = COALESCE(stats, '{}'::jsonb) || jsonb_build_object('matching', v_stats)
  WHERE id = p_import_id;

  RETURN v_stats;
END;
$$;

COMMENT ON FUNCTION public.organizer_match_exhibitor_list(uuid) IS
  'Rapproche les lignes d''un import organisateur avec exposants et participation. L''id_exposant saisi fait autorite mais est confronte au domaine ET au nom : tout desaccord devient id_conflict a arbitrer. Rejouable a volonte.';

REVOKE EXECUTE ON FUNCTION public.organizer_match_exhibitor_list(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.organizer_match_exhibitor_list(uuid) FROM anon;
GRANT  EXECUTE ON FUNCTION public.organizer_match_exhibitor_list(uuid) TO authenticated, service_role;
