-- =====================================================================
-- Phase 3E-A — Backend: exhibitor duplicate detection & invalid-website
-- audit. DETECTION ONLY. No merge, no slug change, no public-facing
-- change, no auto cleanup. No UI (delivered later in Phase 3E-B).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0) PREFLIGHT CHECKS — fail fast with a clear message if a critical
--    dependency is missing.
-- ---------------------------------------------------------------------
DO $preflight$
BEGIN
  IF to_regprocedure('public.is_admin()') IS NULL THEN
    RAISE EXCEPTION 'Preflight failed: public.is_admin() is missing';
  END IF;

  IF to_regprocedure('public.update_updated_at_column()') IS NULL THEN
    RAISE EXCEPTION 'Preflight failed: public.update_updated_at_column() is missing';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'unaccent') THEN
    RAISE EXCEPTION 'Preflight failed: unaccent() not available (enable extension "unaccent")';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'similarity') THEN
    RAISE EXCEPTION 'Preflight failed: similarity() not available (enable extension "pg_trgm")';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_views WHERE schemaname = 'public' AND viewname = 'public_exhibitor_profiles'
  ) THEN
    RAISE EXCEPTION 'Preflight failed: view public.public_exhibitor_profiles is missing';
  END IF;

  IF (
    SELECT count(*) FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'public_exhibitor_profiles'
      AND column_name IN (
        'public_identity_id','public_slug','display_name','website','linkedin_url',
        'source_type','total_participations','future_participations_count','next_event_at'
      )
  ) <> 9 THEN
    RAISE EXCEPTION 'Preflight failed: public_exhibitor_profiles is missing one or more required columns';
  END IF;
END
$preflight$;

-- ---------------------------------------------------------------------
-- 1) Admin decisions table
-- ---------------------------------------------------------------------
CREATE TABLE public.exhibitor_duplicate_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identity_a_id uuid NOT NULL
    REFERENCES public.exhibitor_public_identities(id) ON DELETE CASCADE,
  identity_b_id uuid NOT NULL
    REFERENCES public.exhibitor_public_identities(id) ON DELETE CASCADE,
  score integer,
  confidence text,
  reasons jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'review_required',
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- Store every pair in a single canonical direction (a < b) so the same
  -- couple can never exist twice in opposite directions.
  CONSTRAINT exhibitor_dup_pair_ordered CHECK (identity_a_id < identity_b_id),
  CONSTRAINT exhibitor_dup_pair_unique UNIQUE (identity_a_id, identity_b_id),
  CONSTRAINT exhibitor_dup_status_chk
    CHECK (status IN ('review_required','distinct','probable_duplicate','ignored')),
  CONSTRAINT exhibitor_dup_confidence_chk
    CHECK (confidence IS NULL OR confidence IN ('high','medium','low')),
  CONSTRAINT exhibitor_dup_score_chk
    CHECK (score IS NULL OR score >= 0),
  CONSTRAINT exhibitor_dup_reasons_obj_chk
    CHECK (jsonb_typeof(reasons) = 'object')
);

-- ---------------------------------------------------------------------
-- 2) GRANTS — strategy: RPC-ONLY.
--    Direct table access is forbidden to anon and authenticated; the
--    admin UI (Phase 3E-B) will use the SECURITY DEFINER RPCs below.
--    Only service_role keeps direct table access.
-- ---------------------------------------------------------------------
REVOKE ALL ON public.exhibitor_duplicate_reviews FROM PUBLIC;
REVOKE ALL ON public.exhibitor_duplicate_reviews FROM anon;
REVOKE ALL ON public.exhibitor_duplicate_reviews FROM authenticated;
GRANT ALL ON public.exhibitor_duplicate_reviews TO service_role;

-- RLS (defense in depth — admins only; service_role bypasses anyway).
ALTER TABLE public.exhibitor_duplicate_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage duplicate reviews"
  ON public.exhibitor_duplicate_reviews
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Service role manages duplicate reviews"
  ON public.exhibitor_duplicate_reviews
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- updated_at trigger (reuses existing helper).
CREATE TRIGGER trg_exhibitor_duplicate_reviews_updated_at
  BEFORE UPDATE ON public.exhibitor_duplicate_reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Helper index for review lookups by status.
CREATE INDEX idx_exhibitor_dup_reviews_status
  ON public.exhibitor_duplicate_reviews (status);

-- =====================================================================
-- 3) Detection RPC — computes candidate pairs on the fly, scores them,
--    joins the admin decision (if any). Admin only. Pure read.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.detect_exhibitor_duplicates(
  p_min_score integer DEFAULT 60,
  p_include_resolved boolean DEFAULT false
)
RETURNS TABLE (
  identity_a_id uuid,
  identity_b_id uuid,
  score integer,
  confidence text,
  reasons jsonb,
  a_slug text,
  a_name text,
  a_source text,
  a_website text,
  a_linkedin text,
  a_participations bigint,
  a_future bigint,
  a_next_event date,
  b_slug text,
  b_name text,
  b_source text,
  b_website text,
  b_linkedin text,
  b_participations bigint,
  b_future bigint,
  b_next_event date,
  status text,
  reviewed_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  RETURN QUERY
  WITH c AS (
    SELECT
      p.public_identity_id AS id,
      p.public_slug,
      p.source_type,
      p.display_name,
      p.website,
      p.linkedin_url,
      p.total_participations,
      p.future_participations_count,
      p.next_event_at,
      NULLIF(regexp_replace(lower(unaccent(p.display_name)), '[^a-z0-9]+', '', 'g'), '') AS name_norm,
      NULLIF(lower(regexp_replace(substring(p.website FROM '^(?:https?://)?(?:www\.)?([^/]+)'), '/$', '')), '') AS domain_norm,
      regexp_replace(p.public_slug, '-[0-9]+$', '') AS base_slug,
      NULLIF(lower(regexp_replace(p.linkedin_url, '/+$', '')), '') AS li_norm
    FROM public_exhibitor_profiles p
    WHERE p.is_test = false
  ),
  -- Strong-signal candidate pairs ------------------------------------
  dom_sizes AS (
    SELECT domain_norm, count(*) AS n
    FROM c WHERE length(domain_norm) > 3
    GROUP BY domain_norm
  ),
  pairs_domain AS (
    SELECT a.id AS a_id, b.id AS b_id
    FROM c a
    JOIN c b ON a.domain_norm = b.domain_norm AND a.id < b.id
    JOIN dom_sizes d ON d.domain_norm = a.domain_norm AND d.n <= 6
    WHERE length(a.domain_norm) > 3
  ),
  pairs_name AS (
    SELECT a.id AS a_id, b.id AS b_id
    FROM c a
    JOIN c b ON a.name_norm = b.name_norm AND a.id < b.id
    WHERE length(a.name_norm) >= 3
  ),
  pairs_slug AS (
    SELECT a.id AS a_id, b.id AS b_id
    FROM c a
    JOIN c b ON a.base_slug = b.base_slug AND a.id < b.id
  ),
  pairs_li AS (
    SELECT a.id AS a_id, b.id AS b_id
    FROM c a
    JOIN c b ON a.li_norm = b.li_norm AND a.id < b.id
    WHERE a.li_norm IS NOT NULL
  ),
  -- Limited fuzzy-name candidate pairs -------------------------------
  -- Blocked by the first 4 normalized chars; oversized blocks (> 80)
  -- are skipped to keep the comparison cost bounded (no massive cross
  -- join). Only names >= 5 chars are eligible.
  nblk AS (
    SELECT id, name_norm, left(name_norm, 4) AS blk
    FROM c WHERE length(name_norm) >= 5
  ),
  blk_ok AS (
    SELECT blk FROM nblk GROUP BY blk HAVING count(*) <= 80
  ),
  nfuzzy AS (
    SELECT n.id, n.name_norm, n.blk
    FROM nblk n JOIN blk_ok USING (blk)
  ),
  pairs_name_close AS (
    SELECT a.id AS a_id, b.id AS b_id
    FROM nfuzzy a
    JOIN nfuzzy b
      ON a.blk = b.blk AND a.id < b.id
     AND a.name_norm <> b.name_norm
     AND similarity(a.name_norm, b.name_norm) >= 0.6
  ),
  all_pairs AS (
    SELECT a_id, b_id FROM pairs_domain
    UNION SELECT a_id, b_id FROM pairs_name
    UNION SELECT a_id, b_id FROM pairs_slug
    UNION SELECT a_id, b_id FROM pairs_li
    UNION SELECT a_id, b_id FROM pairs_name_close
  ),
  scored AS (
    SELECT
      ap.a_id,
      ap.b_id,
      (ca.domain_norm IS NOT NULL AND ca.domain_norm = cb.domain_norm) AS same_domain,
      (ca.li_norm IS NOT NULL AND ca.li_norm = cb.li_norm) AS same_linkedin,
      (ca.name_norm IS NOT NULL AND ca.name_norm = cb.name_norm) AS same_name,
      (ca.base_slug = cb.base_slug) AS same_base_slug,
      (ca.name_norm IS DISTINCT FROM cb.name_norm
        AND ca.name_norm IS NOT NULL AND cb.name_norm IS NOT NULL
        AND similarity(ca.name_norm, cb.name_norm) >= 0.6) AS name_close,
      ((ca.source_type = 'legacy') <> (cb.source_type = 'legacy')) AS source_complementary,
      ca.public_slug AS a_slug, ca.display_name AS a_name, ca.source_type AS a_source,
      ca.website AS a_website, ca.linkedin_url AS a_linkedin,
      ca.total_participations AS a_participations, ca.future_participations_count AS a_future,
      ca.next_event_at AS a_next_event,
      cb.public_slug AS b_slug, cb.display_name AS b_name, cb.source_type AS b_source,
      cb.website AS b_website, cb.linkedin_url AS b_linkedin,
      cb.total_participations AS b_participations, cb.future_participations_count AS b_future,
      cb.next_event_at AS b_next_event
    FROM all_pairs ap
    JOIN c ca ON ca.id = ap.a_id
    JOIN c cb ON cb.id = ap.b_id
  ),
  final AS (
    SELECT
      s.a_id, s.b_id,
      (CASE WHEN s.same_domain THEN 60 ELSE 0 END
       + CASE WHEN s.same_linkedin THEN 80 ELSE 0 END
       + CASE WHEN s.same_name THEN 50 ELSE 0 END
       + CASE WHEN s.same_base_slug THEN 40 ELSE 0 END
       + CASE WHEN s.name_close AND NOT s.same_name THEN 45 ELSE 0 END
       + CASE WHEN s.source_complementary THEN 15 ELSE 0 END) AS sc,
      jsonb_strip_nulls(jsonb_build_object(
        'same_domain', NULLIF(s.same_domain, false),
        'same_linkedin', NULLIF(s.same_linkedin, false),
        'same_name', NULLIF(s.same_name, false),
        'same_base_slug', NULLIF(s.same_base_slug, false),
        'name_close', NULLIF(s.name_close AND NOT s.same_name, false),
        'source_complementary', NULLIF(s.source_complementary, false)
      )) AS rsn,
      s.a_slug, s.a_name, s.a_source, s.a_website, s.a_linkedin, s.a_participations, s.a_future, s.a_next_event,
      s.b_slug, s.b_name, s.b_source, s.b_website, s.b_linkedin, s.b_participations, s.b_future, s.b_next_event
    FROM scored s
  )
  SELECT
    f.a_id, f.b_id, f.sc,
    CASE WHEN f.sc >= 80 THEN 'high'
         WHEN f.sc >= 60 THEN 'medium'
         ELSE 'low' END AS confidence,
    f.rsn,
    f.a_slug, f.a_name, f.a_source, f.a_website, f.a_linkedin, f.a_participations, f.a_future, f.a_next_event,
    f.b_slug, f.b_name, f.b_source, f.b_website, f.b_linkedin, f.b_participations, f.b_future, f.b_next_event,
    COALESCE(r.status, 'review_required') AS status,
    r.reviewed_at
  FROM final f
  LEFT JOIN public.exhibitor_duplicate_reviews r
    ON r.identity_a_id = f.a_id AND r.identity_b_id = f.b_id
  WHERE f.sc >= GREATEST(p_min_score, 40)
    AND (p_include_resolved OR COALESCE(r.status, 'review_required') NOT IN ('distinct', 'ignored'))
  ORDER BY f.sc DESC, f.a_name;
END;
$$;

-- =====================================================================
-- 4) Review decision RPC — upserts an admin decision for a pair, always
--    stored in canonical order (a < b). Admin only.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.review_exhibitor_duplicate(
  p_a uuid,
  p_b uuid,
  p_status text,
  p_score integer DEFAULT NULL,
  p_confidence text DEFAULT NULL,
  p_reasons jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_a uuid;
  v_b uuid;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  IF p_status NOT IN ('review_required','distinct','probable_duplicate','ignored') THEN
    RAISE EXCEPTION 'Invalid status %', p_status;
  END IF;

  IF p_a IS NULL OR p_b IS NULL OR p_a = p_b THEN
    RAISE EXCEPTION 'Invalid pair';
  END IF;

  IF p_confidence IS NOT NULL AND p_confidence NOT IN ('high','medium','low') THEN
    RAISE EXCEPTION 'Invalid confidence %', p_confidence;
  END IF;

  -- Canonical ordering so the same couple is never stored twice.
  IF p_a < p_b THEN v_a := p_a; v_b := p_b; ELSE v_a := p_b; v_b := p_a; END IF;

  INSERT INTO public.exhibitor_duplicate_reviews
    (identity_a_id, identity_b_id, score, confidence, reasons, status, reviewed_by, reviewed_at)
  VALUES
    (v_a, v_b, p_score, p_confidence, COALESCE(p_reasons, '{}'::jsonb), p_status, auth.uid(), now())
  ON CONFLICT (identity_a_id, identity_b_id)
  DO UPDATE SET
    status      = EXCLUDED.status,
    score       = COALESCE(EXCLUDED.score, public.exhibitor_duplicate_reviews.score),
    confidence  = COALESCE(EXCLUDED.confidence, public.exhibitor_duplicate_reviews.confidence),
    reasons     = COALESCE(EXCLUDED.reasons, public.exhibitor_duplicate_reviews.reasons),
    reviewed_by = auth.uid(),
    reviewed_at = now();
END;
$$;

-- =====================================================================
-- 5) Invalid-websites audit RPC — lists non-test profiles whose website
--    is present but not normalizable (mirrors client normalizeExternalUrl
--    rejection rules). Read only. Admin only.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.list_invalid_exhibitor_websites()
RETURNS TABLE (
  public_identity_id uuid,
  public_slug text,
  display_name text,
  source_type text,
  website text,
  exhibitor_id uuid,
  reason text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  RETURN QUERY
  SELECT
    p.public_identity_id,
    p.public_slug,
    p.display_name,
    p.source_type,
    p.website,
    p.exhibitor_id,
    CASE
      WHEN p.website ~ '\s' THEN 'Contient des espaces / texte libre'
      WHEN p.website LIKE '/%' THEN 'Chemin relatif'
      WHEN p.website ILIKE '%@%' THEN 'Ressemble à une adresse e-mail'
      ELSE 'Format de domaine invalide'
    END AS reason
  FROM public_exhibitor_profiles p
  WHERE p.is_test = false
    AND p.website IS NOT NULL
    AND btrim(p.website) <> ''
    AND NOT (
      p.website !~ '\s'
      AND p.website ~* '^(https?://)?[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9-]+)+(/.*)?$'
    )
  ORDER BY p.source_type, p.display_name;
END;
$$;

-- ---------------------------------------------------------------------
-- 6) Function execution grants — admins call via authenticated; each
--    function enforces is_admin() internally. anon is excluded.
-- ---------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.detect_exhibitor_duplicates(integer, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.detect_exhibitor_duplicates(integer, boolean) FROM anon;
REVOKE ALL ON FUNCTION public.review_exhibitor_duplicate(uuid, uuid, text, integer, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.review_exhibitor_duplicate(uuid, uuid, text, integer, text, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.list_invalid_exhibitor_websites() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_invalid_exhibitor_websites() FROM anon;

GRANT EXECUTE ON FUNCTION public.detect_exhibitor_duplicates(integer, boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.review_exhibitor_duplicate(uuid, uuid, text, integer, text, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.list_invalid_exhibitor_websites() TO authenticated, service_role;