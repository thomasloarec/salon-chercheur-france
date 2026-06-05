
-- =====================================================================
-- Réconciliation des identités publiques — OUTILS DE PREVIEW (read-only)
-- Corrections : idempotence, normalisation domaine, pair_key, garde-fou.
-- Aucune écriture sur les tables métier.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Helpers internes (read-only) — créés en premier (réutilisés ensuite)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._is_uuid_text(p_val text)
RETURNS boolean
LANGUAGE sql IMMUTABLE
AS $$
  SELECT p_val IS NOT NULL
     AND p_val ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
$$;

CREATE OR REPLACE FUNCTION public._recon_norm_domain(p_val text)
RETURNS text
LANGUAGE sql IMMUTABLE
AS $$
  SELECT NULLIF(
    regexp_replace(
      lower(coalesce(substring(p_val FROM '^(?:https?://)?(?:www\.)?([^/]+)'), '')),
      '/.*$', ''
    ),
  '');
$$;

-- ---------------------------------------------------------------------
-- 2) Table blacklist de domaines partagés (vide, non active) — idempotent
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.exhibitor_duplicate_domain_blacklist (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain      text NOT NULL,
  reason      text,
  created_by  uuid,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT exhibitor_dup_domain_blacklist_domain_not_blank CHECK (btrim(domain) <> '')
);

-- Index unique sur le domaine normalisé (lowercase) : pas de variantes en double
CREATE UNIQUE INDEX IF NOT EXISTS exhibitor_dup_domain_blacklist_lower_uidx
  ON public.exhibitor_duplicate_domain_blacklist (lower(domain));

REVOKE ALL ON public.exhibitor_duplicate_domain_blacklist FROM PUBLIC;
REVOKE ALL ON public.exhibitor_duplicate_domain_blacklist FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exhibitor_duplicate_domain_blacklist TO authenticated;
GRANT ALL ON public.exhibitor_duplicate_domain_blacklist TO service_role;

ALTER TABLE public.exhibitor_duplicate_domain_blacklist ENABLE ROW LEVEL SECURITY;

-- Idempotence : supprimer policies/triggers avant recréation
DROP POLICY IF EXISTS "Admins manage duplicate domain blacklist" ON public.exhibitor_duplicate_domain_blacklist;
DROP POLICY IF EXISTS "Service role manages duplicate domain blacklist" ON public.exhibitor_duplicate_domain_blacklist;
DROP TRIGGER IF EXISTS trg_exhibitor_dup_domain_blacklist_updated_at ON public.exhibitor_duplicate_domain_blacklist;
DROP TRIGGER IF EXISTS trg_exhibitor_dup_domain_blacklist_normalize ON public.exhibitor_duplicate_domain_blacklist;

CREATE POLICY "Admins manage duplicate domain blacklist"
  ON public.exhibitor_duplicate_domain_blacklist
  FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "Service role manages duplicate domain blacklist"
  ON public.exhibitor_duplicate_domain_blacklist
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Normalisation automatique du domaine (cohérente avec _recon_norm_domain)
CREATE OR REPLACE FUNCTION public._normalize_blacklist_domain()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
BEGIN
  NEW.domain := public._recon_norm_domain(NEW.domain);
  IF NEW.domain IS NULL OR btrim(NEW.domain) = '' THEN
    RAISE EXCEPTION 'blacklist domain invalid (empty after normalization)';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_exhibitor_dup_domain_blacklist_normalize
  BEFORE INSERT OR UPDATE ON public.exhibitor_duplicate_domain_blacklist
  FOR EACH ROW EXECUTE FUNCTION public._normalize_blacklist_domain();

CREATE TRIGGER trg_exhibitor_dup_domain_blacklist_updated_at
  BEFORE UPDATE ON public.exhibitor_duplicate_domain_blacklist
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------
-- 3) Profil de dépendances d'une identité (read-only) + garde-fou
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._exhibitor_identity_dep_profile(p_identity_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  epi          public.exhibitor_public_identities%ROWTYPE;
  v_ex_name    text;
  v_ex_site    text;
  v_owner      boolean := false;
  v_leg_name   text;
  v_leg_site   text;
  v_leg_domain text;
  v_norm_dom   text;
  v_part       bigint := 0;
  v_nov        bigint := 0;
  v_leads      bigint := 0;
  v_team       bigint := 0;
  v_crm        bigint := 0;
  v_airtable   text;
  v_mirror     text;
  v_hard       boolean;
  v_dep_score  numeric;
BEGIN
  -- Garde-fou : admin ou service_role uniquement (défense en profondeur)
  IF NOT public.is_admin() AND auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'admin only';
  END IF;

  SELECT * INTO epi FROM public.exhibitor_public_identities WHERE id = p_identity_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  IF epi.exhibitor_id IS NOT NULL THEN
    SELECT name, website, (owner_user_id IS NOT NULL)
      INTO v_ex_name, v_ex_site, v_owner
      FROM public.exhibitors WHERE id = epi.exhibitor_id;
    SELECT count(*) INTO v_team
      FROM public.exhibitor_team_members
      WHERE exhibitor_id = epi.exhibitor_id AND status = 'active';
    SELECT count(*) INTO v_nov
      FROM public.novelties
      WHERE exhibitor_id = epi.exhibitor_id AND status = 'published'
        AND COALESCE(is_test, false) = false;
    SELECT count(*) INTO v_leads
      FROM public.leads WHERE exhibitor_id = epi.exhibitor_id;
  END IF;

  IF epi.legacy_exposant_id IS NOT NULL THEN
    SELECT nom_exposant, website_exposant, normalized_domain
      INTO v_leg_name, v_leg_site, v_leg_domain
      FROM public.exposants WHERE id_exposant = epi.legacy_exposant_id ORDER BY id LIMIT 1;
    SELECT count(*) INTO v_crm
      FROM public.crm_company_event_matches WHERE id_exposant = epi.legacy_exposant_id;
  END IF;

  SELECT count(DISTINCT p.id_participation) INTO v_part
  FROM public.participation p
  WHERE (epi.legacy_exposant_id IS NOT NULL AND p.id_exposant = epi.legacy_exposant_id)
     OR (epi.exhibitor_id IS NOT NULL AND p.exhibitor_id = epi.exhibitor_id);

  v_airtable := CASE WHEN epi.legacy_exposant_id IS NOT NULL
                      AND NOT public._is_uuid_text(epi.legacy_exposant_id)
                     THEN epi.legacy_exposant_id END;
  v_mirror   := CASE
                  WHEN epi.legacy_exposant_id IS NOT NULL AND public._is_uuid_text(epi.legacy_exposant_id)
                    THEN epi.legacy_exposant_id
                  WHEN epi.exhibitor_id IS NOT NULL THEN epi.exhibitor_id::text
                END;

  v_norm_dom := COALESCE(
                  public._recon_norm_domain(v_leg_domain),
                  public._recon_norm_domain(v_leg_site),
                  public._recon_norm_domain(v_ex_site)
                );

  v_hard := v_owner OR v_nov > 0 OR v_leads > 0 OR v_team > 0 OR v_crm > 0;
  v_dep_score := v_part + v_nov * 10 + v_leads * 5 + v_team * 5 + v_crm * 3
                 + CASE WHEN v_owner THEN 20 ELSE 0 END;

  RETURN jsonb_build_object(
    'identity_id', epi.id,
    'public_slug', epi.public_slug,
    'canonical_name', epi.canonical_name,
    'source_type', epi.source_type,
    'is_active', epi.is_active,
    'exhibitor_id', epi.exhibitor_id,
    'exhibitor_name', v_ex_name,
    'exhibitor_website', v_ex_site,
    'owner_present', v_owner,
    'legacy_exposant_id', epi.legacy_exposant_id,
    'legacy_name', v_leg_name,
    'legacy_website', v_leg_site,
    'normalized_domain', v_norm_dom,
    'airtable_real_id', v_airtable,
    'uuid_mirror_id', v_mirror,
    'participations_count', v_part,
    'published_novelties_count', v_nov,
    'leads_count', v_leads,
    'active_team_count', v_team,
    'crm_matches_count', v_crm,
    'has_hard_deps', v_hard,
    'dep_score', v_dep_score
  );
END;
$$;

-- ---------------------------------------------------------------------
-- 4) RPC de PREVIEW (read-only, admin only) — plan PAR PAIRE
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_preview_exhibitor_identity_reconciliation(
  p_min_score integer DEFAULT 60
)
RETURNS TABLE (
  pair_key                    text,
  pair_identity_ids           uuid[],
  group_key                   text,
  status                      text,
  category                    text,
  score                       integer,
  confidence                  text,
  same_domain                 boolean,
  website_conflict            boolean,
  recommended_keep_slug       text,
  recommended_deactivate_slug text,
  plan_text                   text,
  reasons                     jsonb,
  side_keep                   jsonb,
  side_deactivate             jsonb
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  r          record;
  pa         jsonb;
  pb         jsonb;
  keep       jsonb;
  deact      jsonb;
  v_dom      text;
  v_shared   boolean;
  v_blacklist boolean;
  v_conflict boolean;
  v_complementary boolean;
  v_same_name boolean;
  v_status   text;
  v_category text;
  v_plan     text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin only';
  END IF;

  FOR r IN
    SELECT d.*, ia.source_type AS a_src, ib.source_type AS b_src
    FROM public.detect_exhibitor_duplicates(p_min_score, false) d
    JOIN public.exhibitor_public_identities ia ON ia.id = d.identity_a_id
    JOIN public.exhibitor_public_identities ib ON ib.id = d.identity_b_id
  LOOP
    pa := public._exhibitor_identity_dep_profile(r.identity_a_id);
    pb := public._exhibitor_identity_dep_profile(r.identity_b_id);
    CONTINUE WHEN pa IS NULL OR pb IS NULL;

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

    v_complementary := (r.a_src = 'legacy') <> (r.b_src = 'legacy');
    v_same_name := COALESCE((r.reasons ? 'same_name'), false);

    IF v_blacklist OR v_shared THEN
      v_status := 'likely_false_positive';
      v_category := 'shared_domain';
    ELSIF (pa->>'has_hard_deps')::boolean AND (pb->>'has_hard_deps')::boolean THEN
      v_status := 'dangerous';
      v_category := 'F';
    ELSIF (deact->>'has_hard_deps')::boolean THEN
      v_status := 'manual_review';
      v_category := 'F';
    ELSIF v_conflict AND NOT COALESCE((r.reasons ? 'same_domain'), false) THEN
      v_status := 'manual_review';
      v_category := CASE WHEN v_same_name THEN 'D' ELSE 'E' END;
    ELSIF COALESCE((r.reasons ? 'same_domain'), false) AND NOT v_same_name
          AND NOT COALESCE((r.reasons ? 'name_close'), false) THEN
      v_status := 'manual_review';
      v_category := 'A2';
    ELSIF v_complementary
          AND (COALESCE((r.reasons ? 'same_domain'), false) OR v_same_name OR COALESCE((r.reasons ? 'name_close'), false))
          AND NOT v_conflict THEN
      v_status := 'auto_reconcilable';
      v_category := 'B';
    ELSIF COALESCE((r.reasons ? 'same_domain'), false)
          AND (v_same_name OR COALESCE((r.reasons ? 'name_close'), false))
          AND NOT v_conflict THEN
      v_status := 'auto_reconcilable';
      v_category := 'A_SAFE';
    ELSE
      v_status := 'manual_review';
      v_category := 'other';
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

    pair_key := r.identity_a_id::text || '_' || r.identity_b_id::text;
    pair_identity_ids := ARRAY[r.identity_a_id, r.identity_b_id];
    group_key := COALESCE(v_dom, lower(keep->>'canonical_name'));
    status := v_status;
    category := v_category;
    score := r.score;
    confidence := r.confidence;
    same_domain := COALESCE((r.reasons ? 'same_domain'), false);
    website_conflict := v_conflict;
    recommended_keep_slug := keep->>'public_slug';
    recommended_deactivate_slug := CASE WHEN v_status = 'auto_reconcilable' THEN deact->>'public_slug' ELSE NULL END;
    plan_text := v_plan;
    reasons := r.reasons;
    side_keep := keep;
    side_deactivate := deact;
    RETURN NEXT;
  END LOOP;
END;
$$;

-- ---------------------------------------------------------------------
-- 5) RPC de SYNTHESE (read-only, admin only) — pairs vs groupes
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_preview_exhibitor_identity_reconciliation_summary(
  p_min_score integer DEFAULT 60
)
RETURNS TABLE (
  pairs_analyzed         integer,
  unique_identities      integer,
  distinct_group_keys    integer,
  auto_reconcilable      integer,
  manual_review          integer,
  dangerous              integer,
  likely_false_positive  integer
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin only';
  END IF;

  RETURN QUERY
  WITH p AS (
    SELECT * FROM public.admin_preview_exhibitor_identity_reconciliation(p_min_score)
  ),
  ids AS (
    SELECT unnest(pair_identity_ids) AS iid FROM p
  )
  SELECT
    (SELECT count(*) FROM p)::int,
    (SELECT count(DISTINCT iid) FROM ids)::int,
    (SELECT count(DISTINCT group_key) FROM p)::int,
    (SELECT count(*) FROM p WHERE status = 'auto_reconcilable')::int,
    (SELECT count(*) FROM p WHERE status = 'manual_review')::int,
    (SELECT count(*) FROM p WHERE status = 'dangerous')::int,
    (SELECT count(*) FROM p WHERE status = 'likely_false_positive')::int;
END;
$$;

-- ---------------------------------------------------------------------
-- 6) Grants
-- ---------------------------------------------------------------------
REVOKE ALL ON FUNCTION public._exhibitor_identity_dep_profile(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_preview_exhibitor_identity_reconciliation(integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_preview_exhibitor_identity_reconciliation_summary(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._exhibitor_identity_dep_profile(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_preview_exhibitor_identity_reconciliation(integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_preview_exhibitor_identity_reconciliation_summary(integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public._is_uuid_text(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public._recon_norm_domain(text) TO authenticated, service_role;
