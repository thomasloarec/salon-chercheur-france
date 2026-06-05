-- ============================================================
-- Réconciliation preview : VUE GROUPÉE (READ ONLY)
-- Regroupe les paires en groupes d'identités connectées.
-- Aucune écriture métier. Pas de merge / deactivate / remap.
-- ============================================================

-- 1) Classifieur de GROUPE (read-only). Reçoit un tableau jsonb de profils
--    de dépendances (issus de _exhibitor_identity_dep_profile) et déduit
--    le statut/catégorie/risque/recommandation du groupe entier.
CREATE OR REPLACE FUNCTION public._recon_classify_group(p_profiles jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_n              int;
  v_elem           jsonb;
  keep             jsonb;
  v_keep_score     numeric := -1;
  v_domains        text[] := '{}';
  v_names          text[] := '{}';
  v_hard_deact     int := 0;
  v_with_nov       int := 0;
  v_with_owner     int := 0;
  v_with_leads     int := 0;
  v_with_crm       int := 0;
  v_with_hard      int := 0;
  v_keep_dom       text;
  v_blacklist      boolean := false;
  v_shared         boolean := false;
  v_distinct_dom   int;
  v_distinct_name  int;
  v_has_legacy     boolean := false;
  v_has_modern     boolean := false;
  v_conflict       boolean;
  v_name_ident     boolean;
  v_status         text;
  v_category       text;
  v_risk           text;
  v_plan           text;
  v_warnings       jsonb := '[]'::jsonb;
  v_deact          jsonb := '[]'::jsonb;
  v_deact_slugs    text := '';
  v_airtable_keep  text;
  v_keep_reason    text;
  v_tot_part       bigint := 0;
  v_tot_nov        bigint := 0;
  v_tot_leads      bigint := 0;
  v_tot_team       bigint := 0;
  v_tot_crm        bigint := 0;
BEGIN
  IF NOT public.is_admin() AND auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'admin only';
  END IF;

  v_n := jsonb_array_length(p_profiles);
  IF v_n IS NULL OR v_n = 0 THEN RETURN NULL; END IF;

  -- Première passe : totaux, agrégats, sélection du keep (dep_score max)
  FOR v_elem IN SELECT * FROM jsonb_array_elements(p_profiles) LOOP
    v_tot_part  := v_tot_part  + COALESCE((v_elem->>'participations_count')::bigint, 0);
    v_tot_nov   := v_tot_nov   + COALESCE((v_elem->>'published_novelties_count')::bigint, 0);
    v_tot_leads := v_tot_leads + COALESCE((v_elem->>'leads_count')::bigint, 0);
    v_tot_team  := v_tot_team  + COALESCE((v_elem->>'active_team_count')::bigint, 0);
    v_tot_crm   := v_tot_crm   + COALESCE((v_elem->>'crm_matches_count')::bigint, 0);

    IF COALESCE((v_elem->>'published_novelties_count')::int, 0) > 0 THEN v_with_nov := v_with_nov + 1; END IF;
    IF COALESCE((v_elem->>'owner_present')::boolean, false)        THEN v_with_owner := v_with_owner + 1; END IF;
    IF COALESCE((v_elem->>'leads_count')::int, 0) > 0             THEN v_with_leads := v_with_leads + 1; END IF;
    IF COALESCE((v_elem->>'crm_matches_count')::int, 0) > 0       THEN v_with_crm := v_with_crm + 1; END IF;
    IF COALESCE((v_elem->>'has_hard_deps')::boolean, false)       THEN v_with_hard := v_with_hard + 1; END IF;

    IF (v_elem->>'source_type') = 'legacy' THEN
      v_has_legacy := true;
    ELSIF (v_elem->>'source_type') IS NOT NULL THEN
      v_has_modern := true;
    END IF;

    IF v_elem->>'normalized_domain' IS NOT NULL THEN
      v_domains := array_append(v_domains, lower(v_elem->>'normalized_domain'));
    END IF;
    IF v_elem->>'canonical_name' IS NOT NULL THEN
      v_names := array_append(v_names, lower(btrim(v_elem->>'canonical_name')));
    END IF;

    IF (v_elem->>'dep_score')::numeric > v_keep_score THEN
      v_keep_score := (v_elem->>'dep_score')::numeric;
      keep := v_elem;
    END IF;
  END LOOP;

  -- Deuxième passe : identités candidates à la désactivation (toutes sauf keep)
  FOR v_elem IN SELECT * FROM jsonb_array_elements(p_profiles) LOOP
    IF (v_elem->>'identity_id') IS DISTINCT FROM (keep->>'identity_id') THEN
      v_deact := v_deact || jsonb_build_array(
        v_elem || jsonb_build_object(
          'deactivation_reason',
          CASE
            WHEN COALESCE((v_elem->>'has_hard_deps')::boolean, false)
              THEN 'Porte des donnees dures (nouveaute/owner/lead/equipe/CRM) : revue manuelle avant toute desactivation.'
            ELSE 'Aucune dependance dure detectee : candidate a desactivation ulterieure une fois la canonique confirmee.'
          END
        )
      );
      IF COALESCE((v_elem->>'has_hard_deps')::boolean, false) THEN
        v_hard_deact := v_hard_deact + 1;
      END IF;
      IF v_elem->>'public_slug' IS NOT NULL THEN
        v_deact_slugs := v_deact_slugs || (CASE WHEN v_deact_slugs = '' THEN '' ELSE ', ' END) || (v_elem->>'public_slug');
      END IF;
    END IF;
  END LOOP;

  v_distinct_dom  := (SELECT count(DISTINCT d) FROM unnest(v_domains) d);
  v_distinct_name := (SELECT count(DISTINCT nm) FROM unnest(v_names) nm);

  v_keep_dom := keep->>'normalized_domain';
  IF v_keep_dom IS NOT NULL THEN
    v_blacklist := EXISTS (
      SELECT 1 FROM public.exhibitor_duplicate_domain_blacklist b
      WHERE lower(b.domain) = v_keep_dom
    );
    v_shared := (
      SELECT count(DISTINCT epi.id) FROM public.exhibitor_public_identities epi
      LEFT JOIN public.exposants le ON le.id_exposant = epi.legacy_exposant_id
      LEFT JOIN public.exhibitors ex ON ex.id = epi.exhibitor_id
      WHERE epi.is_active = true
        AND COALESCE(
              public._recon_norm_domain(le.normalized_domain),
              public._recon_norm_domain(le.website_exposant),
              public._recon_norm_domain(ex.website)
            ) = v_keep_dom
    ) > 6;
  END IF;

  v_conflict   := v_distinct_dom > 1;
  v_name_ident := v_distinct_name <= 1;

  -- Règles de décision (ordre = priorité)
  IF v_blacklist OR v_shared THEN
    v_status := 'likely_false_positive'; v_category := 'shared_domain'; v_risk := 'faible';
  ELSIF (v_with_nov >= 2) OR (v_with_owner >= 2) OR (v_with_leads >= 2)
        OR (v_with_crm >= 2) OR (v_with_hard >= 2) THEN
    v_status := 'dangerous'; v_category := 'dangerous'; v_risk := 'eleve';
  ELSIF (v_distinct_name > 1 AND v_distinct_dom > 1) THEN
    -- noms ET domaines differents -> faux positif probable
    v_status := 'likely_false_positive'; v_category := 'manual'; v_risk := 'faible';
  ELSIF (v_name_ident AND v_conflict)
        OR (v_distinct_dom = 1 AND v_distinct_name > 1)
        OR (v_n > 3)
        OR (v_hard_deact >= 1) THEN
    v_status := 'manual_review';
    v_category := CASE WHEN v_n > 3 THEN 'mixed' ELSE 'manual' END;
    v_risk := 'moyen';
  ELSIF v_has_legacy AND v_has_modern
        AND (v_distinct_dom <= 1 OR v_name_ident)
        AND v_hard_deact = 0 AND NOT v_conflict THEN
    v_status := 'auto_reconcilable'; v_category := 'B'; v_risk := 'faible';
  ELSIF v_distinct_dom = 1 AND v_name_ident AND v_hard_deact = 0 AND NOT v_conflict THEN
    v_status := 'auto_reconcilable'; v_category := 'A_SAFE'; v_risk := 'faible';
  ELSE
    v_status := 'manual_review'; v_category := 'manual'; v_risk := 'moyen';
  END IF;

  -- Avertissements
  IF v_with_nov >= 1 THEN
    v_warnings := v_warnings || jsonb_build_array('Au moins une fiche porte des nouveautes publiees (a preserver).');
  END IF;
  IF v_with_nov >= 2 THEN
    v_warnings := v_warnings || jsonb_build_array('Plusieurs fiches portent des nouveautes publiees.');
  END IF;
  IF v_with_owner >= 2 THEN
    v_warnings := v_warnings || jsonb_build_array('Plusieurs fiches ont un owner / une equipe active.');
  END IF;
  IF v_with_leads >= 2 THEN
    v_warnings := v_warnings || jsonb_build_array('Plusieurs fiches ont des leads.');
  END IF;
  IF v_with_crm >= 2 THEN
    v_warnings := v_warnings || jsonb_build_array('Plusieurs fiches ont des liens CRM.');
  END IF;
  IF v_conflict THEN
    v_warnings := v_warnings || jsonb_build_array('Conflit de domaine entre les fiches du groupe.');
  END IF;
  IF v_blacklist THEN
    v_warnings := v_warnings || jsonb_build_array('Domaine blackliste : faux positif probable.');
  END IF;
  IF v_shared THEN
    v_warnings := v_warnings || jsonb_build_array('Domaine partage par de nombreuses fiches (generique).');
  END IF;
  IF v_hard_deact >= 1 THEN
    v_warnings := v_warnings || jsonb_build_array('Une fiche candidate a la desactivation porte des donnees dures.');
  END IF;
  IF (keep->>'airtable_real_id') IS NOT NULL OR (
       SELECT bool_or((e->>'airtable_real_id') IS NOT NULL)
       FROM jsonb_array_elements(p_profiles) e
     ) THEN
    v_warnings := v_warnings || jsonb_build_array('Preserver le ou les ID Airtable reels lors de toute reconciliation future.');
  END IF;

  v_airtable_keep := keep->>'airtable_real_id';
  v_keep_reason := format(
    'Fiche au score de dependances le plus eleve (%s) : %s participations, %s nouveautes, %s leads, %s membres equipe, %s liens CRM%s.',
    keep->>'dep_score',
    COALESCE(keep->>'participations_count','0'),
    COALESCE(keep->>'published_novelties_count','0'),
    COALESCE(keep->>'leads_count','0'),
    COALESCE(keep->>'active_team_count','0'),
    COALESCE(keep->>'crm_matches_count','0'),
    CASE WHEN COALESCE((keep->>'owner_present')::boolean,false) THEN ', owner present' ELSE '' END
  );

  v_plan := CASE v_status
    WHEN 'auto_reconcilable' THEN
      format(
        'Conserver active la fiche publique "%s" (%s). Plus tard, desactiver : %s. %s%s Ne pas supprimer les lignes sources (exposants ET exhibitors).',
        keep->>'public_slug',
        keep->>'canonical_name',
        COALESCE(NULLIF(v_deact_slugs,''), 'aucune'),
        CASE WHEN v_airtable_keep IS NOT NULL
             THEN format('Rattacher si besoin l''ID Airtable reel %s a la fiche conservee. ', v_airtable_keep)
             ELSE '' END,
        CASE WHEN v_tot_part > 0
             THEN 'Remap des participations a confirmer en phase ulterieure. ' ELSE '' END)
    WHEN 'dangerous' THEN
      'Plusieurs fiches du groupe portent des donnees dures (owner/nouveaute/lead/equipe/CRM). Revue manuelle obligatoire, aucune automatisation possible.'
    WHEN 'likely_false_positive' THEN
      'Groupe probablement non fusionnable (domaine partage/generique/blackliste ou entreprises distinctes). A exclure des corrections automatiques.'
    ELSE
      format('Revue manuelle requise (categorie %s). Choix de la fiche canonique a confirmer avant toute action.', v_category)
  END;

  RETURN jsonb_build_object(
    'status_group', v_status,
    'category_group', v_category,
    'risk_level', v_risk,
    'main_name', keep->>'canonical_name',
    'main_domain', v_keep_dom,
    'recommended_keep_slug', keep->>'public_slug',
    'recommended_keep_identity', keep || jsonb_build_object('keep_reason', v_keep_reason),
    'identities', p_profiles,
    'identities_potentially_deactivatable', v_deact,
    'plan_text_group', v_plan,
    'warnings', v_warnings,
    'total_participations', v_tot_part,
    'total_novelties', v_tot_nov,
    'total_leads', v_tot_leads,
    'total_teams', v_tot_team,
    'total_crm', v_tot_crm
  );
END;
$function$;

-- 2) RPC GROUPÉE paginée (read-only, admin only).
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
      SELECT node, min(root) AS group_root FROM cc GROUP BY node
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
      SELECT node, min(root) AS group_root FROM cc GROUP BY node
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

-- 3) Synthèse par statut au niveau GROUPE (heavy, on demand).
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
    SELECT node, min(root) AS group_root FROM cc GROUP BY node
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

-- 4) Permissions : admin-only via garde interne ; exposer authenticated + service_role.
REVOKE ALL ON FUNCTION public._recon_classify_group(jsonb) FROM public, anon;
REVOKE ALL ON FUNCTION public.admin_preview_exhibitor_identity_reconciliation_groups(integer, text, text, text, integer, integer) FROM public, anon;
REVOKE ALL ON FUNCTION public.admin_preview_exhibitor_identity_reconciliation_groups_breakdown(integer) FROM public, anon;

GRANT EXECUTE ON FUNCTION public._recon_classify_group(jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_preview_exhibitor_identity_reconciliation_groups(integer, text, text, text, integer, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_preview_exhibitor_identity_reconciliation_groups_breakdown(integer) TO authenticated, service_role;