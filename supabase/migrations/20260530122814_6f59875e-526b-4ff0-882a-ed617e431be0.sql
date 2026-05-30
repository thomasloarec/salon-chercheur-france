-- =====================================================================
-- Phase 2A (V2) — Public exhibitor identity layer
-- Read + insert into a brand-new table only. No existing table is modified.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. PREFLIGHT — abort loudly if any critical assumption is false
-- ---------------------------------------------------------------------
DO $preflight$
DECLARE
  v_cnt int;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='exhibitor_public_identities') THEN
    RAISE EXCEPTION 'PREFLIGHT FAIL: table public.exhibitor_public_identities already exists (migration is not idempotent). Aborting.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
                 WHERE n.nspname='public' AND p.proname='update_updated_at_column') THEN
    RAISE EXCEPTION 'PREFLIGHT FAIL: public.update_updated_at_column() is missing.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname='unaccent') THEN
    RAISE EXCEPTION 'PREFLIGHT FAIL: unaccent() is not available.';
  END IF;

  SELECT count(*) INTO v_cnt FROM public.exhibitors WHERE slug IS NULL OR btrim(slug)='';
  IF v_cnt > 0 THEN
    RAISE EXCEPTION 'PREFLIGHT FAIL: % exhibitor(s) have a null/empty slug.', v_cnt;
  END IF;

  SELECT count(*) INTO v_cnt FROM (SELECT slug FROM public.exhibitors GROUP BY slug HAVING count(*)>1) d;
  IF v_cnt > 0 THEN
    RAISE EXCEPTION 'PREFLIGHT FAIL: % duplicated exhibitor slug group(s).', v_cnt;
  END IF;

  -- fan-out A: one exhibitor_id -> several id_exposant
  SELECT count(*) INTO v_cnt FROM (
    SELECT exhibitor_id FROM public.participation
    WHERE exhibitor_id IS NOT NULL AND id_exposant IS NOT NULL
    GROUP BY exhibitor_id HAVING count(DISTINCT id_exposant) > 1
  ) f;
  IF v_cnt > 0 THEN
    RAISE EXCEPTION 'PREFLIGHT FAIL: % exhibitor_id linked to multiple id_exposant (fan-out). Resolve manually; aborting.', v_cnt;
  END IF;

  -- fan-out B: one id_exposant -> several exhibitor_id
  SELECT count(*) INTO v_cnt FROM (
    SELECT id_exposant FROM public.participation
    WHERE exhibitor_id IS NOT NULL AND id_exposant IS NOT NULL
    GROUP BY id_exposant HAVING count(DISTINCT exhibitor_id) > 1
  ) f2;
  IF v_cnt > 0 THEN
    RAISE EXCEPTION 'PREFLIGHT FAIL: % id_exposant linked to multiple exhibitor_id (fan-out). Resolve manually; aborting.', v_cnt;
  END IF;

  RAISE NOTICE 'PREFLIGHT OK';
END;
$preflight$;

-- ---------------------------------------------------------------------
-- 1. Slug helpers
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.exhibitor_slug_normalize(p_name text)
RETURNS text
LANGUAGE plpgsql
STABLE
SET search_path = public, extensions
AS $$
DECLARE s text;
BEGIN
  s := coalesce(p_name, '');
  s := extensions.unaccent(s);
  s := lower(s);
  s := regexp_replace(s, '[^a-z0-9]+', '-', 'g');
  s := regexp_replace(s, '-{2,}', '-', 'g');
  s := btrim(s, '-');
  RETURN s; -- may be '' (caller applies fallback)
END;
$$;

-- next available with NO starting suffix (simple slug first, then -2, -3, ...)
CREATE OR REPLACE FUNCTION public.exhibitor_slug_next_available(p_base text)
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE candidate text; i int := 1;
BEGIN
  LOOP
    candidate := CASE WHEN i = 1 THEN p_base ELSE p_base || '-' || i END;
    IF NOT EXISTS (SELECT 1 FROM public.exhibitor_public_identities WHERE public_slug = candidate) THEN
      RETURN candidate;
    END IF;
    i := i + 1;
  END LOOP;
END;
$$;

-- next available starting AT a given suffix index (used for ambiguous duplicate groups)
CREATE OR REPLACE FUNCTION public.exhibitor_slug_next_available_from(p_base text, p_start int)
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE candidate text; i int := GREATEST(p_start, 1);
BEGIN
  LOOP
    candidate := p_base || '-' || i;
    IF NOT EXISTS (SELECT 1 FROM public.exhibitor_public_identities WHERE public_slug = candidate) THEN
      RETURN candidate;
    END IF;
    i := i + 1;
  END LOOP;
END;
$$;

-- ---------------------------------------------------------------------
-- 2. Table
-- ---------------------------------------------------------------------
CREATE TABLE public.exhibitor_public_identities (
  id                 uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  legacy_exposant_id text NULL,  -- logical ref to exposants.id_exposant (NO FK: imports rebuild that table)
  exhibitor_id       uuid NULL REFERENCES public.exhibitors(id) ON DELETE RESTRICT,
  public_slug        text NOT NULL,
  canonical_name     text NOT NULL,
  source_type        text NOT NULL,
  is_active          boolean NOT NULL DEFAULT true,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT exhibitor_public_identities_source_type_chk
    CHECK (source_type IN ('legacy','modern','linked')),
  CONSTRAINT exhibitor_public_identities_at_least_one_ref_chk
    CHECK (legacy_exposant_id IS NOT NULL OR exhibitor_id IS NOT NULL),
  CONSTRAINT exhibitor_public_identities_slug_not_blank_chk
    CHECK (btrim(public_slug) <> ''),
  CONSTRAINT exhibitor_public_identities_source_consistency_chk
    CHECK (
      (source_type = 'modern' AND exhibitor_id IS NOT NULL AND legacy_exposant_id IS NULL) OR
      (source_type = 'legacy' AND legacy_exposant_id IS NOT NULL AND exhibitor_id IS NULL) OR
      (source_type = 'linked' AND legacy_exposant_id IS NOT NULL AND exhibitor_id IS NOT NULL)
    )
);

-- FK choice: exhibitor_id -> exhibitors(id) ON DELETE RESTRICT.
-- A modern fiche cannot be deleted while a public identity (and its stable slug) points to it.
-- No FK to exposants.id_exposant: the legacy table is rebuilt by Airtable/N8N imports; an FK
-- would either break imports (RESTRICT) or wipe stable slugs (CASCADE). Logical ref only.

GRANT SELECT ON public.exhibitor_public_identities TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exhibitor_public_identities TO authenticated;
GRANT ALL ON public.exhibitor_public_identities TO service_role;

ALTER TABLE public.exhibitor_public_identities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read exhibitor identities"
ON public.exhibitor_public_identities FOR SELECT USING (true);

CREATE POLICY "Admins manage exhibitor identities"
ON public.exhibitor_public_identities FOR ALL
USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "Service role manages exhibitor identities"
ON public.exhibitor_public_identities FOR ALL
USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

CREATE UNIQUE INDEX exhibitor_public_identities_slug_uidx
  ON public.exhibitor_public_identities (public_slug);
CREATE UNIQUE INDEX exhibitor_public_identities_legacy_uidx
  ON public.exhibitor_public_identities (legacy_exposant_id)
  WHERE legacy_exposant_id IS NOT NULL;
CREATE UNIQUE INDEX exhibitor_public_identities_exhibitor_uidx
  ON public.exhibitor_public_identities (exhibitor_id)
  WHERE exhibitor_id IS NOT NULL;
CREATE INDEX exhibitor_public_identities_source_type_idx
  ON public.exhibitor_public_identities (source_type);
CREATE INDEX exhibitor_public_identities_is_active_idx
  ON public.exhibitor_public_identities (is_active);

CREATE TRIGGER trg_exhibitor_public_identities_updated_at
BEFORE UPDATE ON public.exhibitor_public_identities
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------
-- 3. SIMULATION — print expected volumes before any write
-- ---------------------------------------------------------------------
DO $sim$
DECLARE
  v_modern int; v_linked int; v_legacy int;
  v_ambig_groups int; v_ambig_rows int; v_modern_coll int; v_fallback int;
BEGIN
  SELECT count(*) FILTER (WHERE lk.id_exposant IS NULL),
         count(*) FILTER (WHERE lk.id_exposant IS NOT NULL)
    INTO v_modern, v_linked
  FROM public.exhibitors x
  LEFT JOIN (SELECT DISTINCT exhibitor_id, id_exposant FROM public.participation
             WHERE exhibitor_id IS NOT NULL AND id_exposant IS NOT NULL) lk
    ON lk.exhibitor_id = x.id;

  WITH linked AS (
    SELECT DISTINCT id_exposant FROM public.participation
    WHERE exhibitor_id IS NOT NULL AND id_exposant IS NOT NULL
  ),
  legacy AS (
    SELECT e.id,
      COALESCE(NULLIF(public.exhibitor_slug_normalize(e.nom_exposant),''), 'exposant-'||e.id) AS base,
      (NULLIF(public.exhibitor_slug_normalize(e.nom_exposant),'') IS NULL) AS is_fallback
    FROM public.exposants e
    WHERE e.id_exposant NOT IN (SELECT id_exposant FROM linked)
  ),
  grp AS (SELECT base, count(*) AS n FROM legacy GROUP BY base)
  SELECT
    (SELECT count(*) FROM legacy),
    (SELECT count(*) FROM grp WHERE n>1),
    (SELECT coalesce(sum(n),0)::int FROM grp WHERE n>1),
    (SELECT count(*) FROM grp g WHERE g.n=1 AND EXISTS (SELECT 1 FROM public.exhibitors x WHERE x.slug=g.base)),
    (SELECT count(*) FROM legacy WHERE is_fallback)
  INTO v_legacy, v_ambig_groups, v_ambig_rows, v_modern_coll, v_fallback;

  RAISE NOTICE 'SIMULATION: modern=%, linked=%, legacy=%, total=%, ambiguous_groups=%, ambiguous_rows_suffixed=%, single_vs_modern_collisions=%, fallbacks=%',
    v_modern, v_linked, v_legacy, (v_modern+v_linked+v_legacy),
    v_ambig_groups, v_ambig_rows, v_modern_coll, v_fallback;
END;
$sim$;

-- ---------------------------------------------------------------------
-- 4. BACKFILL — stage 1: modern + linked (reuse existing exhibitor slug)
-- ---------------------------------------------------------------------
INSERT INTO public.exhibitor_public_identities
  (exhibitor_id, legacy_exposant_id, public_slug, canonical_name, source_type)
SELECT
  x.id,
  lm.id_exposant,
  x.slug,
  x.name,
  CASE WHEN lm.id_exposant IS NOT NULL THEN 'linked' ELSE 'modern' END
FROM public.exhibitors x
LEFT JOIN (
  SELECT DISTINCT exhibitor_id, id_exposant
  FROM public.participation
  WHERE exhibitor_id IS NOT NULL AND id_exposant IS NOT NULL
) lm ON lm.exhibitor_id = x.id;

-- ---------------------------------------------------------------------
-- 4. BACKFILL — stage 2: legacy
--   Slug rule:
--   * normalized base unique in the legacy set  -> simple slug (or -2.. only if it
--     collides with a reserved modern slug, via next_available()).
--   * normalized base appears >1 in legacy set   -> suffix from the FIRST occurrence:
--     base-1, base-2, base-3 ... (via next_available_from(base, ord)).
--   Modern slugs were inserted first, so they are reserved and never overwritten.
-- ---------------------------------------------------------------------
DO $legacy$
DECLARE
  r RECORD; v_slug text;
BEGIN
  FOR r IN
    WITH linked AS (
      SELECT DISTINCT id_exposant FROM public.participation
      WHERE exhibitor_id IS NOT NULL AND id_exposant IS NOT NULL
    ),
    legacy AS (
      SELECT e.id_exposant, e.id AS num_id, e.nom_exposant,
        COALESCE(NULLIF(public.exhibitor_slug_normalize(e.nom_exposant),''), 'exposant-'||e.id) AS base
      FROM public.exposants e
      WHERE e.id_exposant NOT IN (SELECT id_exposant FROM linked)
    ),
    grp AS (SELECT base, count(*) AS n FROM legacy GROUP BY base)
    SELECT l.id_exposant, l.num_id, l.nom_exposant, l.base, g.n AS grp_count,
           row_number() OVER (PARTITION BY l.base ORDER BY l.num_id)::int AS ord
    FROM legacy l JOIN grp g USING (base)
    ORDER BY l.num_id
  LOOP
    IF r.grp_count = 1 THEN
      v_slug := public.exhibitor_slug_next_available(r.base);
    ELSE
      v_slug := public.exhibitor_slug_next_available_from(r.base, r.ord);
    END IF;

    INSERT INTO public.exhibitor_public_identities
      (legacy_exposant_id, public_slug, canonical_name, source_type)
    VALUES
      (r.id_exposant, v_slug,
       COALESCE(NULLIF(btrim(r.nom_exposant), ''), v_slug),
       'legacy');
  END LOOP;
END;
$legacy$;

-- ---------------------------------------------------------------------
-- 5. POST-CHECK — fail if any invariant is broken
-- ---------------------------------------------------------------------
DO $validate$
DECLARE v int;
BEGIN
  SELECT count(*) INTO v FROM public.exhibitor_public_identities
   WHERE public_slug IS NULL OR btrim(public_slug)='';
  IF v>0 THEN RAISE EXCEPTION 'POSTCHECK FAIL: % blank slug(s).', v; END IF;

  SELECT count(*) INTO v FROM public.exhibitor_public_identities
   WHERE legacy_exposant_id IS NULL AND exhibitor_id IS NULL;
  IF v>0 THEN RAISE EXCEPTION 'POSTCHECK FAIL: % row(s) with both refs null.', v; END IF;

  RAISE NOTICE 'POSTCHECK OK';
END;
$validate$;