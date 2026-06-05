
-- ============================================================
-- Reconciliation preview: performance refactor (READ ONLY)
-- No business data is modified. No merge / deactivate / remap.
-- ============================================================

-- 1) Helpful secondary indexes (only the ones not already present)
CREATE INDEX IF NOT EXISTS idx_crm_matches_id_exposant
  ON public.crm_company_event_matches (id_exposant);

CREATE INDEX IF NOT EXISTS idx_novelties_exhibitor_status_test
  ON public.novelties (exhibitor_id, status, is_test);

-- 2) Reusable single-pair classifier (read-only).
--    Mirrors exactly the logic of the detailed preview RPC, but for ONE pair.
CREATE OR REPLACE FUNCTION public._recon_classify_pair(
  p_a uuid,
  p_b uuid,
  p_reasons jsonb,
  p_a_src text,
  p_b_src text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  pa jsonb; pb jsonb; keep jsonb; deact jsonb;
  v_dom text; v_shared boolean; v_blacklist boolean; v_conflict boolean;
  v_complementary boolean; v_same_name boolean;
  v_status text; v_category text; v_plan text;
BEGIN
  IF NOT public.is_admin() AND auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'admin only';
  END IF;

  pa := public._exhibitor_identity_dep_profile(p_a);
  pb := public._exhibitor_identity_dep_profile(p_b);
  IF pa IS NULL OR pb IS NULL THEN RETURN NULL; END IF;

  IF (pb->>'dep_score')::numeric > (pa->>'dep_score')::numeric THEN
    keep := pb; deact := pa;
  ELSE
    keep := pa; deact := pb;
  END IF;

  v_dom := keep->>'normalized_domain';
  v_blacklist := v_dom IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.exhibitor_duplicate_domain_blacklist b
    WHERE lower(b.domain) = v_dom
  );
  v_shared := v_dom IS NOT NULL AND (
    SELECT count(DISTINCT epi.id) FROM public.exhibitor_public_identities epi
    LEFT JOIN public.exposants le ON le.id_exposant = epi.legacy_exposant_id
    LEFT JOIN public.exhibitors ex ON ex.id = epi.exhibitor_id
    WHERE epi.is_active = true
      AND COALESCE(
            public._recon_norm_domain(le.normalized_domain),
            public._recon_norm_domain(le.website_exposant),
            public._recon_norm_domain(ex.website)
          ) = v_dom
  ) > 6;

  v_conflict := (pa->>'normalized_domain') IS NOT NULL
            AND (pb->>'normalized_domain') IS NOT NULL
            AND (pa->>'normalized_domain') <> (pb->>'normalized_domain');

  v_complementary := (p_a_src = 'legacy') <> (p_b_src = 'legacy');
  v_same_name := COALESCE((p_reasons ? 'same_name'), false);

  IF v_blacklist OR v_shared THEN
    v_status := 'likely_false_positive'; v_category := 'shared_domain';
  ELSIF (pa->>'has_hard_deps')::boolean AND (pb->>'has_hard_deps')::boolean THEN
    v_status := 'dangerous'; v_category := 'F';
  ELSIF (deact->>'has_hard_deps')::boolean THEN
    v_status := 'manual_review'; v_category := 'F';
  ELSIF v_conflict AND NOT COALESCE((p_reasons ? 'same_domain'), false) THEN
    v_status := 'manual_review';
    v_category := CASE WHEN v_same_name THEN 'D' ELSE 'E' END;
  ELSIF COALESCE((p_reasons ? 'same_domain'), false) AND NOT v_same_name
        AND NOT COALESCE((p_reasons ? 'name_close'), false) THEN
    v_status := 'manual_review'; v_category := 'A2';
  ELSIF v_complementary
        AND (COALESCE((p_reasons ? 'same_domain'), false) OR v_same_name OR COALESCE((p_reasons ? 'name_close'), false))
        AND NOT v_conflict THEN
    v_status := 'auto_reconcilable'; v_category := 'B';
  ELSIF COALESCE((p_reasons ? 'same_domain'), false)
        AND (v_same_name OR COALESCE((p_reasons ? 'name_close'), false))
        AND NOT v_conflict THEN
    v_status := 'auto_reconcilable'; v_category := 'A_SAFE';
  ELSE
    v_status := 'manual_review'; v_category := 'other';
  END IF;

  v_plan := CASE v_status
    WHEN 'auto_reconcilable' THEN
      format('Garder active la fiche "%s" (score deps %s). Desactiver plus tard "%s" (aucune dependance dure). %s%s Conserver les lignes sources dans exposants ET exhibitors.',
        keep->>'public_slug', keep->>'dep_score', deact->>'public_slug',
        CASE WHEN deact->>'airtable_real_id' IS NOT NULL
             THEN format('Rattacher l''ID Airtable reel %s a la fiche conservee. ', deact->>'airtable_real_id')
             ELSE '' END,
        CASE WHEN (deact->>'participations_count')::int > 0
             THEN 'Remap participation a confirmer en phase ulterieure. ' ELSE '' END)
    WHEN 'dangerous' THEN
      'Les deux fiches portent des donnees dures (owner/nouveaute/lead/equipe/CRM). Revue manuelle obligatoire, aucune automatisation.'
    WHEN 'likely_false_positive' THEN
      format('Domaine partage/generique (%s). Probable faux positif, exclure des corrections automatiques.', v_dom)
    ELSE
      'Revue manuelle requise (categorie '||v_category||').'
  END;

  RETURN jsonb_build_object(
    'status', v_status,
    'category', v_category,
    'group_key', COALESCE(v_dom, lower(keep->>'canonical_name')),
    'same_domain', COALESCE((p_reasons ? 'same_domain'), false),
    'website_conflict', v_conflict,
    'recommended_keep_slug', keep->>'public_slug',
    'recommended_deactivate_slug', CASE WHEN v_status = 'auto_reconcilable' THEN deact->>'public_slug' ELSE NULL END,
    'plan_text', v_plan,
    'side_keep', keep,
    'side_deactivate', deact
  );
END;
$function$;

-- 3) Paginated, search-first preview. Only the returned page rows are enriched.
CREATE OR REPLACE FUNCTION public.admin_preview_exhibitor_identity_reconciliation_page(
  p_min_score integer DEFAULT 60,
  p_status text DEFAULT NULL,
  p_category text DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  pair_key text,
  pair_identity_ids uuid[],
  group_key text,
  status text,
  category text,
  score integer,
  confidence text,
  same_domain boolean,
  website_conflict boolean,
  recommended_keep_slug text,
  recommended_deactivate_slug text,
  plan_text text,
  reasons jsonb,
  side_keep jsonb,
  side_deactivate jsonb,
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
    -- FAST PATH: search + paginate on the cheap candidate set,
    -- classify ONLY the page rows.
    RETURN QUERY
    WITH cand AS (
      SELECT d.identity_a_id, d.identity_b_id, d.score, d.confidence, d.reasons,
             d.a_name, d.a_source, d.b_source,
             count(*) OVER() AS total
      FROM public.detect_exhibitor_duplicates(p_min_score, false) d
      WHERE v_pat IS NULL OR (
            d.a_name ILIKE v_pat OR d.b_name ILIKE v_pat
         OR d.a_slug ILIKE v_pat OR d.b_slug ILIKE v_pat
         OR COALESCE(d.a_website, '') ILIKE v_pat
         OR COALESCE(d.b_website, '') ILIKE v_pat
      )
    ),
    pg AS (
      SELECT * FROM cand ORDER BY score DESC, a_name LIMIT v_lim OFFSET v_off
    )
    SELECT
      pg.identity_a_id::text || '_' || pg.identity_b_id::text,
      ARRAY[pg.identity_a_id, pg.identity_b_id],
      cl->>'group_key',
      cl->>'status',
      cl->>'category',
      pg.score,
      pg.confidence,
      (cl->>'same_domain')::boolean,
      (cl->>'website_conflict')::boolean,
      cl->>'recommended_keep_slug',
      cl->>'recommended_deactivate_slug',
      cl->>'plan_text',
      pg.reasons,
      cl->'side_keep',
      cl->'side_deactivate',
      pg.total::int
    FROM pg
    CROSS JOIN LATERAL public._recon_classify_pair(
      pg.identity_a_id, pg.identity_b_id, pg.reasons, pg.a_source, pg.b_source
    ) AS cl
    WHERE cl IS NOT NULL;
  ELSE
    -- FILTERED PATH (on demand): classify the searched candidate set,
    -- then filter by status/category, then paginate.
    RETURN QUERY
    WITH cand AS (
      SELECT d.identity_a_id, d.identity_b_id, d.score, d.confidence, d.reasons,
             d.a_name, d.a_source, d.b_source
      FROM public.detect_exhibitor_duplicates(p_min_score, false) d
      WHERE v_pat IS NULL OR (
            d.a_name ILIKE v_pat OR d.b_name ILIKE v_pat
         OR d.a_slug ILIKE v_pat OR d.b_slug ILIKE v_pat
         OR COALESCE(d.a_website, '') ILIKE v_pat
         OR COALESCE(d.b_website, '') ILIKE v_pat
      )
    ),
    cls AS (
      SELECT c.identity_a_id, c.identity_b_id, c.score, c.confidence, c.reasons, c.a_name,
             cl AS j
      FROM cand c
      CROSS JOIN LATERAL public._recon_classify_pair(
        c.identity_a_id, c.identity_b_id, c.reasons, c.a_source, c.b_source
      ) AS cl
      WHERE cl IS NOT NULL
        AND (v_status_f IS NULL OR cl->>'status' = v_status_f)
        AND (v_cat_f IS NULL OR cl->>'category' = v_cat_f)
    ),
    withtot AS (
      SELECT *, count(*) OVER() AS total FROM cls
    ),
    pg AS (
      SELECT * FROM withtot ORDER BY score DESC, a_name LIMIT v_lim OFFSET v_off
    )
    SELECT
      pg.identity_a_id::text || '_' || pg.identity_b_id::text,
      ARRAY[pg.identity_a_id, pg.identity_b_id],
      pg.j->>'group_key',
      pg.j->>'status',
      pg.j->>'category',
      pg.score,
      pg.confidence,
      (pg.j->>'same_domain')::boolean,
      (pg.j->>'website_conflict')::boolean,
      pg.j->>'recommended_keep_slug',
      pg.j->>'recommended_deactivate_slug',
      pg.j->>'plan_text',
      pg.reasons,
      pg.j->'side_keep',
      pg.j->'side_deactivate',
      pg.total::int
    FROM pg;
  END IF;
END;
$function$;

-- 4) Lightweight summary (cheap counts only; no dependency profiles).
CREATE OR REPLACE FUNCTION public.admin_preview_exhibitor_identity_reconciliation_summary(
  p_min_score integer DEFAULT 60
)
RETURNS TABLE(
  pairs_analyzed integer,
  unique_identities integer,
  distinct_group_keys integer,
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
  WITH cand AS (
    SELECT d.identity_a_id, d.identity_b_id, d.a_name, d.a_website, d.b_website
    FROM public.detect_exhibitor_duplicates(p_min_score, false) d
  ),
  ids AS (
    SELECT identity_a_id AS iid FROM cand
    UNION
    SELECT identity_b_id FROM cand
  ),
  grp AS (
    SELECT COALESCE(
      public._recon_norm_domain(a_website),
      public._recon_norm_domain(b_website),
      lower(a_name)
    ) AS gk
    FROM cand
  )
  SELECT
    (SELECT count(*) FROM cand)::int,
    (SELECT count(*) FROM ids)::int,
    (SELECT count(DISTINCT gk) FROM grp)::int,
    NULL::int,  -- status breakdown computed on demand (see _status_breakdown)
    NULL::int,
    NULL::int,
    NULL::int;
END;
$function$;

-- 5) On-demand status breakdown (heavier; triggered by an explicit button).
CREATE OR REPLACE FUNCTION public.admin_preview_exhibitor_identity_reconciliation_status_breakdown(
  p_min_score integer DEFAULT 60
)
RETURNS TABLE(
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
  WITH cls AS (
    SELECT cl->>'status' AS st
    FROM public.detect_exhibitor_duplicates(p_min_score, false) d
    CROSS JOIN LATERAL public._recon_classify_pair(
      d.identity_a_id, d.identity_b_id, d.reasons, d.a_source, d.b_source
    ) AS cl
    WHERE cl IS NOT NULL
  )
  SELECT
    count(*) FILTER (WHERE st = 'auto_reconcilable')::int,
    count(*) FILTER (WHERE st = 'manual_review')::int,
    count(*) FILTER (WHERE st = 'dangerous')::int,
    count(*) FILTER (WHERE st = 'likely_false_positive')::int
  FROM cls;
END;
$function$;

-- 6) Permissions: admin-only via internal guard; expose to authenticated + service_role.
REVOKE ALL ON FUNCTION public._recon_classify_pair(uuid, uuid, jsonb, text, text) FROM public, anon;
REVOKE ALL ON FUNCTION public.admin_preview_exhibitor_identity_reconciliation_page(integer, text, text, text, integer, integer) FROM public, anon;
REVOKE ALL ON FUNCTION public.admin_preview_exhibitor_identity_reconciliation_status_breakdown(integer) FROM public, anon;

GRANT EXECUTE ON FUNCTION public._recon_classify_pair(uuid, uuid, jsonb, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_preview_exhibitor_identity_reconciliation_page(integer, text, text, text, integer, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_preview_exhibitor_identity_reconciliation_status_breakdown(integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_preview_exhibitor_identity_reconciliation_summary(integer) TO authenticated, service_role;
