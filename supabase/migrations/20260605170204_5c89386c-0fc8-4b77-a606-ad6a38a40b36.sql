-- ============================================================
-- FIX technique (read-only) : min(uuid) does not exist
-- Remplace min(root) par min(root::text)::uuid dans les CTE comp
-- des RPC de vue groupée. Aucune écriture métier.
-- ============================================================

CREATE OR REPLACE FUNCTION public.admin_preview_exhibitor_identity_reconciliation_groups(
  p_min_score integer DEFAULT 60,
  p_status text DEFAULT NULL,
  p_category text DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  group_key text,
  identity_ids uuid[],
  identities_count integer,
  names text[],
  domains text[],
  sources text[],
  statuses text[],
  categories text[],
  score_max integer,
  score_avg numeric,
  confidence_max text,
  status_group text,
  category_group text,
  risk_level text,
  main_name text,
  main_domain text,
  recommended_keep_slug text,
  recommended_keep_identity jsonb,
  identities jsonb,
  identities_potentially_deactivatable jsonb,
  plan_text_group text,
  warnings jsonb,
  total_participations bigint,
  total_novelties bigint,
  total_leads bigint,
  total_teams bigint,
  total_crm bigint,
  total_count integer
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_lim int := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100);
  v_off int := GREATEST(COALESCE(p_offset, 0), 0);
  v_search text := NULLIF(btrim(COALESCE(p_search, '')), '');
  v_pat text := NULL;
  v_status_f text := NULLIF(btrim(COALESCE(p_status, '')), '');
  v_cat_f text := NULLIF(btrim(COALESCE(p_category, '')), '');
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin only';
  END IF;

  IF v_search IS NOT NULL THEN
    v_pat := '%' || v_search || '%';
  END IF;

  IF v_status_f IS NULL AND v_cat_f IS NULL THEN
    -- FAST PATH : grouper + chercher (peu couteux), enrichir SEULEMENT la page.
    RETURN QUERY
    WITH RECURSIVE cand AS MATERIALIZED (
      SELECT d.identity_a_id AS a, d.identity_b_id AS b, d.score, d.confidence,
             d.a_name, d.b_name, d.a_slug, d.b_slug, d.a_website, d.b_website,
             d.a_source, d.b_source
      FROM public.detect_exhibitor_duplicates(p_min_score, false) d
    ),
    edges AS (
      SELECT a, b FROM cand
      UNION
      SELECT b, a FROM cand
    ),
    nodes AS (
      SELECT a AS node FROM cand UNION SELECT b FROM cand
    ),
    cc AS (
      SELECT node, node AS root, 0 AS depth FROM nodes
      UNION
      SELECT e.b, c.root, c.depth + 1
      FROM cc c JOIN edges e ON e.a = c.node
      WHERE c.depth < 25
    ),
    comp AS (
      SELECT node, min(root::text)::uuid AS group_root FROM cc GROUP BY node
    ),
    node_site AS (
      SELECT a AS node, a_name AS nm, a_slug AS sl, a_website AS ws, a_source AS src FROM cand
      UNION
      SELECT b, b_name, b_slug, b_website, b_source FROM cand
    ),
    node_meta AS (
      SELECT epi.id AS node, epi.exhibitor_id, epi.legacy_exposant_id
      FROM public.exhibitor_public_identities epi
      WHERE epi.id IN (SELECT node FROM nodes)
    ),
    grp_meta AS (
      SELECT comp.group_root,
             count(DISTINCT comp.node)::int AS cnt,
             array_remove(array_agg(DISTINCT ns.nm), NULL) AS names,
             array_remove(array_agg(DISTINCT public._recon_norm_domain(ns.ws)), NULL) AS domains,
             array_remove(array_agg(DISTINCT ns.src), NULL) AS sources,
             array_agg(DISTINCT comp.node) AS ids
      FROM comp JOIN node_site ns ON ns.node = comp.node
      GROUP BY comp.group_root
    ),
    edge_agg AS (
      SELECT comp.group_root,
             max(c.score)::int AS score_max,
             round(avg(c.score), 1) AS score_avg,
             max(CASE c.confidence WHEN 'high' THEN 3 WHEN 'medium' THEN 2 WHEN 'low' THEN 1 ELSE 0 END) AS conf_rank
      FROM cand c JOIN comp ON comp.node = c.a
      GROUP BY comp.group_root
    ),
    grp_search AS (
      SELECT comp.group_root,
             bool_or(
               v_pat IS NULL
               OR ns.nm ILIKE v_pat OR ns.sl ILIKE v_pat
               OR COALESCE(ns.ws, '') ILIKE v_pat
               OR COALESCE(nm.exhibitor_id::text, '') ILIKE v_pat
               OR COALESCE(nm.legacy_exposant_id, '') ILIKE v_pat
             ) AS matched
      FROM comp
      JOIN node_site ns ON ns.node = comp.node
      LEFT JOIN node_meta nm ON nm.node = comp.node
      GROUP BY comp.group_root
    ),
    sel AS (
      SELECT gm.group_root, ea.score_max, ea.score_avg, ea.conf_rank,
             gm.cnt, gm.names, gm.domains, gm.sources, gm.ids,
             count(*) OVER() AS total
      FROM grp_meta gm
      JOIN grp_search gs ON gs.group_root = gm.group_root
      JOIN edge_agg ea ON ea.group_root = gm.group_root
      WHERE gs.matched
    ),
    pg AS (
      SELECT * FROM sel
      ORDER BY score_max DESC NULLS LAST, group_root
      LIMIT v_lim OFFSET v_off
    ),
    prof AS (
      SELECT comp.group_root, jsonb_agg(p.prof ORDER BY comp.node) AS profiles
      FROM comp
      JOIN pg ON pg.group_root = comp.group_root
      CROSS JOIN LATERAL public._exhibitor_identity_dep_profile(comp.node) AS p(prof)
      WHERE p.prof IS NOT NULL
      GROUP BY comp.group_root
    )
    SELECT
      pg.group_root::text,
      pg.ids,
      pg.cnt,
      pg.names,
      pg.domains,
      pg.sources,
      ARRAY[cl->>'status_group'],
      ARRAY[cl->>'category_group'],
      pg.score_max,
      pg.score_avg,
      CASE pg.conf_rank WHEN 3 THEN 'high' WHEN 2 THEN 'medium' WHEN 1 THEN 'low' ELSE 'low' END,
      cl->>'status_group',
      cl->>'category_group',
      cl->>'risk_level',
      cl->>'main_name',
      cl->>'main_domain',
      cl->>'recommended_keep_slug',
      cl->'recommended_keep_identity',
      cl->'identities',
      cl->'identities_potentially_deactivatable',
      cl->>'plan_text_group',
      cl->'warnings',
      (cl->>'total_participations')::bigint,
      (cl->>'total_novelties')::bigint,
      (cl->>'total_leads')::bigint,
      (cl->>'total_teams')::bigint,
      (cl->>'total_crm')::bigint,
      pg.total::int
    FROM pg
    JOIN prof ON prof.group_root = pg.group_root
    CROSS JOIN LATERAL public._recon_classify_group(prof.profiles) AS cl
    WHERE cl IS NOT NULL
    ORDER BY pg.score_max DESC NULLS LAST, pg.group_root;

  ELSE
    -- FILTERED PATH (on demand) : enrichir tous les groupes, classifier, filtrer, paginer.
    RETURN QUERY
    WITH RECURSIVE cand AS MATERIALIZED (
      SELECT d.identity_a_id AS a, d.identity_b_id AS b, d.score, d.confidence,
             d.a_name, d.b_name, d.a_slug, d.b_slug, d.a_website, d.b_website,
             d.a_source, d.b_source
      FROM public.detect_exhibitor_duplicates(p_min_score, false) d
    ),
    edges AS (
      SELECT a, b FROM cand UNION SELECT b, a FROM cand
    ),
    nodes AS (
      SELECT a AS node FROM cand UNION SELECT b FROM cand
    ),
    cc AS (
      SELECT node, node AS root, 0 AS depth FROM nodes
      UNION
      SELECT e.b, c.root, c.depth + 1
      FROM cc c JOIN edges e ON e.a = c.node
      WHERE c.depth < 25
    ),
    comp AS (
      SELECT node, min(root::text)::uuid AS group_root FROM cc GROUP BY node
    ),
    node_site AS (
      SELECT a AS node, a_name AS nm, a_slug AS sl, a_website AS ws, a_source AS src FROM cand
      UNION
      SELECT b, b_name, b_slug, b_website, b_source FROM cand
    ),
    node_meta AS (
      SELECT epi.id AS node, epi.exhibitor_id, epi.legacy_exposant_id
      FROM public.exhibitor_public_identities epi
      WHERE epi.id IN (SELECT node FROM nodes)
    ),
    grp_meta AS (
      SELECT comp.group_root,
             count(DISTINCT comp.node)::int AS cnt,
             array_remove(array_agg(DISTINCT ns.nm), NULL) AS names,
             array_remove(array_agg(DISTINCT public._recon_norm_domain(ns.ws)), NULL) AS domains,
             array_remove(array_agg(DISTINCT ns.src), NULL) AS sources,
             array_agg(DISTINCT comp.node) AS ids
      FROM comp JOIN node_site ns ON ns.node = comp.node
      GROUP BY comp.group_root
    ),
    edge_agg AS (
      SELECT comp.group_root,
             max(c.score)::int AS score_max,
             round(avg(c.score), 1) AS score_avg,
             max(CASE c.confidence WHEN 'high' THEN 3 WHEN 'medium' THEN 2 WHEN 'low' THEN 1 ELSE 0 END) AS conf_rank
      FROM cand c JOIN comp ON comp.node = c.a
      GROUP BY comp.group_root
    ),
    grp_search AS (
      SELECT comp.group_root,
             bool_or(
               v_pat IS NULL
               OR ns.nm ILIKE v_pat OR ns.sl ILIKE v_pat
               OR COALESCE(ns.ws, '') ILIKE v_pat
               OR COALESCE(nm.exhibitor_id::text, '') ILIKE v_pat
               OR COALESCE(nm.legacy_exposant_id, '') ILIKE v_pat
             ) AS matched
      FROM comp
      JOIN node_site ns ON ns.node = comp.node
      LEFT JOIN node_meta nm ON nm.node = comp.node
      GROUP BY comp.group_root
    ),
    prof AS (
      SELECT comp.group_root, jsonb_agg(p.prof ORDER BY comp.node) AS profiles
      FROM comp
      CROSS JOIN LATERAL public._exhibitor_identity_dep_profile(comp.node) AS p(prof)
      WHERE p.prof IS NOT NULL
      GROUP BY comp.group_root
    ),
    cls AS (
      SELECT gm.group_root, ea.score_max, ea.score_avg, ea.conf_rank,
             gm.cnt, gm.names, gm.domains, gm.sources, gm.ids,
             cl AS j
      FROM grp_meta gm
      JOIN grp_search gs ON gs.group_root = gm.group_root AND gs.matched
      JOIN edge_agg ea ON ea.group_root = gm.group_root
      JOIN prof ON prof.group_root = gm.group_root
      CROSS JOIN LATERAL public._recon_classify_group(prof.profiles) AS cl
      WHERE cl IS NOT NULL
        AND (v_status_f IS NULL OR cl->>'status_group' = v_status_f)
        AND (v_cat_f IS NULL OR cl->>'category_group' = v_cat_f)
    ),
    withtot AS (
      SELECT *, count(*) OVER() AS total FROM cls
    ),
    pg AS (
      SELECT * FROM withtot
      ORDER BY score_max DESC NULLS LAST, group_root
      LIMIT v_lim OFFSET v_off
    )
    SELECT
      pg.group_root::text,
      pg.ids,
      pg.cnt,
      pg.names,
      pg.domains,
      pg.sources,
      ARRAY[pg.j->>'status_group'],
      ARRAY[pg.j->>'category_group'],
      pg.score_max,
      pg.score_avg,
      CASE pg.conf_rank WHEN 3 THEN 'high' WHEN 2 THEN 'medium' WHEN 1 THEN 'low' ELSE 'low' END,
      pg.j->>'status_group',
      pg.j->>'category_group',
      pg.j->>'risk_level',
      pg.j->>'main_name',
      pg.j->>'main_domain',
      pg.j->>'recommended_keep_slug',
      pg.j->'recommended_keep_identity',
      pg.j->'identities',
      pg.j->'identities_potentially_deactivatable',
      pg.j->>'plan_text_group',
      pg.j->'warnings',
      (pg.j->>'total_participations')::bigint,
      (pg.j->>'total_novelties')::bigint,
      (pg.j->>'total_leads')::bigint,
      (pg.j->>'total_teams')::bigint,
      (pg.j->>'total_crm')::bigint,
      pg.total::int
    FROM pg
    ORDER BY pg.score_max DESC NULLS LAST, pg.group_root;
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_preview_exhibitor_identity_reconciliation_groups_breakdown(
  p_min_score integer DEFAULT 60
)
RETURNS TABLE(
  groups_total integer,
  auto_reconcilable integer,
  manual_review integer,
  dangerous integer,
  likely_false_positive integer
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin only';
  END IF;

  RETURN QUERY
  WITH RECURSIVE cand AS MATERIALIZED (
    SELECT d.identity_a_id AS a, d.identity_b_id AS b
    FROM public.detect_exhibitor_duplicates(p_min_score, false) d
  ),
  edges AS (
    SELECT a, b FROM cand UNION SELECT b, a FROM cand
  ),
  nodes AS (
    SELECT a AS node FROM cand UNION SELECT b FROM cand
  ),
  cc AS (
    SELECT node, node AS root, 0 AS depth FROM nodes
    UNION
    SELECT e.b, c.root, c.depth + 1
    FROM cc c JOIN edges e ON e.a = c.node
    WHERE c.depth < 25
  ),
  comp AS (
    SELECT node, min(root::text)::uuid AS group_root FROM cc GROUP BY node
  ),
  prof AS (
    SELECT comp.group_root, jsonb_agg(p.prof) AS profiles
    FROM comp
    CROSS JOIN LATERAL public._exhibitor_identity_dep_profile(comp.node) AS p(prof)
    WHERE p.prof IS NOT NULL
    GROUP BY comp.group_root
  ),
  cls AS (
    SELECT (public._recon_classify_group(prof.profiles))->>'status_group' AS st
    FROM prof
  )
  SELECT
    count(*)::int,
    count(*) FILTER (WHERE st = 'auto_reconcilable')::int,
    count(*) FILTER (WHERE st = 'manual_review')::int,
    count(*) FILTER (WHERE st = 'dangerous')::int,
    count(*) FILTER (WHERE st = 'likely_false_positive')::int
  FROM cls;
END;
$function$;