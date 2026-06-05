-- ============================================================
-- Réconciliation preview : performance vue groupée (READ ONLY)
-- 1) recherche ciblée (seed-first) ; 2) top groupes light ;
-- 3) détail d'un groupe à la demande. Aucune écriture métier.
-- ============================================================

-- ------------------------------------------------------------
-- 1) RECHERCHE CIBLÉE : seed-first. Ne construit les composantes
--    qu'à partir des identités matchant la recherche, puis enrichit
--    uniquement ces groupes. Retourne le même shape que la vue groupe.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_search_exhibitor_identity_reconciliation_groups(
  p_search text,
  p_min_score integer DEFAULT 60,
  p_limit integer DEFAULT 50
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
  v_search text := NULLIF(btrim(COALESCE(p_search, '')), '');
  v_pat text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin only';
  END IF;
  IF v_search IS NULL OR length(v_search) < 2 THEN
    RAISE EXCEPTION 'p_search obligatoire (minimum 2 caracteres)';
  END IF;
  v_pat := '%' || v_search || '%';

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
  node_site AS (
    SELECT a AS node, a_name AS nm, a_slug AS sl, a_website AS ws, a_source AS src FROM cand
    UNION
    SELECT b, b_name, b_slug, b_website, b_source FROM cand
  ),
  node_meta AS (
    SELECT epi.id AS node, epi.exhibitor_id, epi.legacy_exposant_id
    FROM public.exhibitor_public_identities epi
    WHERE epi.id IN (SELECT a FROM cand UNION SELECT b FROM cand)
  ),
  seeds AS (
    SELECT DISTINCT ns.node
    FROM node_site ns
    LEFT JOIN node_meta nm ON nm.node = ns.node
    WHERE ns.nm ILIKE v_pat
       OR ns.sl ILIKE v_pat
       OR COALESCE(ns.ws, '') ILIKE v_pat
       OR COALESCE(nm.exhibitor_id::text, '') ILIKE v_pat
       OR COALESCE(nm.legacy_exposant_id, '') ILIKE v_pat
  ),
  cc AS (
    SELECT node, node AS root, 0 AS depth FROM seeds
    UNION
    SELECT e.b, c.root, c.depth + 1
    FROM cc c JOIN edges e ON e.a = c.node
    WHERE c.depth < 25
  ),
  comp AS (
    SELECT node, min(root::text)::uuid AS group_root FROM cc GROUP BY node
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
  sel AS (
    SELECT gm.group_root, gm.cnt, gm.names, gm.domains, gm.sources, gm.ids,
           ea.score_max, ea.score_avg, ea.conf_rank,
           count(*) OVER() AS total
    FROM grp_meta gm
    JOIN edge_agg ea ON ea.group_root = gm.group_root
  ),
  pg AS (
    SELECT * FROM sel
    ORDER BY score_max DESC NULLS LAST, group_root
    LIMIT v_lim
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
END;
$function$;

-- ------------------------------------------------------------
-- 2) TOP GROUPES LIGHT : groupage + méta léger uniquement.
--    Ne calcule NI _exhibitor_identity_dep_profile NI _recon_classify_group.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_preview_exhibitor_identity_reconciliation_groups_light(
  p_min_score integer DEFAULT 60,
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
  score_max integer,
  score_avg numeric,
  confidence_max text,
  total_count integer
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_lim int := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100);
  v_off int := GREATEST(COALESCE(p_offset, 0), 0);
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin only';
  END IF;

  RETURN QUERY
  WITH RECURSIVE cand AS MATERIALIZED (
    SELECT d.identity_a_id AS a, d.identity_b_id AS b, d.score, d.confidence,
           d.a_name, d.b_name, d.a_website, d.b_website, d.a_source, d.b_source
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
    SELECT a AS node, a_name AS nm, a_website AS ws, a_source AS src FROM cand
    UNION
    SELECT b, b_name, b_website, b_source FROM cand
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
  sel AS (
    SELECT gm.group_root, gm.cnt, gm.names, gm.domains, gm.sources, gm.ids,
           ea.score_max, ea.score_avg, ea.conf_rank,
           count(*) OVER() AS total
    FROM grp_meta gm
    JOIN edge_agg ea ON ea.group_root = gm.group_root
  )
  SELECT
    sel.group_root::text,
    sel.ids,
    sel.cnt,
    sel.names,
    sel.domains,
    sel.sources,
    sel.score_max,
    sel.score_avg,
    CASE sel.conf_rank WHEN 3 THEN 'high' WHEN 2 THEN 'medium' WHEN 1 THEN 'low' ELSE 'low' END,
    sel.total::int
  FROM sel
  ORDER BY sel.score_max DESC NULLS LAST, sel.group_root
  LIMIT v_lim OFFSET v_off;
END;
$function$;

-- ------------------------------------------------------------
-- 3) DÉTAIL D'UN GROUPE À LA DEMANDE : enrichit uniquement les
--    identités passées. Calcule profiles + classify pour ce seul groupe.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_preview_exhibitor_identity_reconciliation_group_detail(
  p_identity_ids uuid[],
  p_min_score integer DEFAULT 60
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
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin only';
  END IF;
  IF p_identity_ids IS NULL OR array_length(p_identity_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH ids AS (
    SELECT DISTINCT x AS node FROM unnest(p_identity_ids) AS x
  ),
  cand AS MATERIALIZED (
    SELECT d.identity_a_id AS a, d.identity_b_id AS b, d.score, d.confidence,
           d.a_name, d.b_name, d.a_website, d.b_website, d.a_source, d.b_source
    FROM public.detect_exhibitor_duplicates(p_min_score, false) d
    WHERE d.identity_a_id IN (SELECT node FROM ids)
       OR d.identity_b_id IN (SELECT node FROM ids)
  ),
  node_site AS (
    SELECT a AS node, a_name AS nm, a_website AS ws, a_source AS src FROM cand
    UNION
    SELECT b, b_name, b_website, b_source FROM cand
  ),
  meta AS (
    SELECT
      array_remove(array_agg(DISTINCT ns.nm), NULL) AS names,
      array_remove(array_agg(DISTINCT public._recon_norm_domain(ns.ws)), NULL) AS domains,
      array_remove(array_agg(DISTINCT ns.src), NULL) AS sources
    FROM node_site ns
    WHERE ns.node IN (SELECT node FROM ids)
  ),
  agg AS (
    SELECT
      max(c.score)::int AS score_max,
      round(avg(c.score), 1) AS score_avg,
      max(CASE c.confidence WHEN 'high' THEN 3 WHEN 'medium' THEN 2 WHEN 'low' THEN 1 ELSE 0 END) AS conf_rank
    FROM cand c
    WHERE c.a IN (SELECT node FROM ids) AND c.b IN (SELECT node FROM ids)
  ),
  prof AS (
    SELECT jsonb_agg(p.prof ORDER BY ids.node) AS profiles
    FROM ids
    CROSS JOIN LATERAL public._exhibitor_identity_dep_profile(ids.node) AS p(prof)
    WHERE p.prof IS NOT NULL
  )
  SELECT
    (SELECT min(node::text) FROM ids)::text,
    ARRAY(SELECT node FROM ids),
    (SELECT count(*) FROM ids)::int,
    meta.names,
    meta.domains,
    meta.sources,
    ARRAY[cl->>'status_group'],
    ARRAY[cl->>'category_group'],
    COALESCE(agg.score_max, 0),
    agg.score_avg,
    CASE agg.conf_rank WHEN 3 THEN 'high' WHEN 2 THEN 'medium' WHEN 1 THEN 'low' ELSE 'low' END,
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
    1
  FROM prof
  CROSS JOIN meta
  CROSS JOIN agg
  CROSS JOIN LATERAL public._recon_classify_group(prof.profiles) AS cl
  WHERE prof.profiles IS NOT NULL AND cl IS NOT NULL;
END;
$function$;

-- ------------------------------------------------------------
-- Permissions : admin-only via garde interne ; exposer authenticated + service_role.
-- ------------------------------------------------------------
REVOKE ALL ON FUNCTION public.admin_search_exhibitor_identity_reconciliation_groups(text, integer, integer) FROM public, anon;
REVOKE ALL ON FUNCTION public.admin_preview_exhibitor_identity_reconciliation_groups_light(integer, integer, integer) FROM public, anon;
REVOKE ALL ON FUNCTION public.admin_preview_exhibitor_identity_reconciliation_group_detail(uuid[], integer) FROM public, anon;

GRANT EXECUTE ON FUNCTION public.admin_search_exhibitor_identity_reconciliation_groups(text, integer, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_preview_exhibitor_identity_reconciliation_groups_light(integer, integer, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_preview_exhibitor_identity_reconciliation_group_detail(uuid[], integer) TO authenticated, service_role;