-- ============================================================================
-- Phase 2A-bis V3 : maintenance automatique des identités publiques exposants
-- Corrections : (1) familles de slugs détectées aussi en unitaire ;
--               (2) transformation modern -> linked sécurisée (jamais de retour incohérent).
-- Autorisation par GRANT uniquement (le cron s'exécute sous postgres, sans JWT).
-- Aucun slug existant recalculé. Aucune route/vue/table créée.
-- ============================================================================

-- 0) Helper interne : insertion robuste, choix du slug selon force_suffix.
CREATE OR REPLACE FUNCTION public.exhibitor_identity_insert_safe(
  p_legacy text,
  p_exhibitor uuid,
  p_base text,
  p_name text,
  p_source text,
  p_force_suffix boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_id uuid;
  v_slug text;
  v_attempt integer := 0;
BEGIN
  LOOP
    v_attempt := v_attempt + 1;
    IF p_force_suffix THEN
      v_slug := public.exhibitor_slug_next_available_from(p_base, 1);
    ELSE
      v_slug := public.exhibitor_slug_next_available(p_base);
    END IF;

    BEGIN
      INSERT INTO public.exhibitor_public_identities
        (legacy_exposant_id, exhibitor_id, public_slug, canonical_name, source_type, is_active)
      VALUES (p_legacy, p_exhibitor, v_slug, p_name, p_source, true)
      RETURNING id INTO v_id;
      RETURN v_id;
    EXCEPTION WHEN unique_violation THEN
      -- Collision sur la référence d'entité (création concurrente) -> renvoyer l'existant
      v_id := NULL;
      IF p_legacy IS NOT NULL THEN
        SELECT id INTO v_id FROM public.exhibitor_public_identities
          WHERE legacy_exposant_id = p_legacy LIMIT 1;
      END IF;
      IF v_id IS NULL AND p_exhibitor IS NOT NULL THEN
        SELECT id INTO v_id FROM public.exhibitor_public_identities
          WHERE exhibitor_id = p_exhibitor LIMIT 1;
      END IF;
      IF v_id IS NOT NULL THEN
        RETURN v_id;
      END IF;
      -- Sinon : collision de slug -> réessayer le slug libre suivant
      IF v_attempt >= 10 THEN
        RAISE EXCEPTION 'exhibitor_identity_insert_safe: unable to allocate unique slug for base "%" after % attempts', p_base, v_attempt;
      END IF;
    END;
  END LOOP;
END;
$$;

-- 1) Fonction unitaire idempotente.
CREATE OR REPLACE FUNCTION public.ensure_exhibitor_public_identity(
  p_legacy_exposant_id text DEFAULT NULL,
  p_exhibitor_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_id uuid;
  v_name text;
  v_num_id integer;
  v_existing_slug text;
  v_base text;
  v_link_count integer;
  v_linked_exhibitor uuid;
  v_force_suffix boolean;
  v_row_legacy text;
  v_row_source text;
BEGIN
  IF (p_legacy_exposant_id IS NULL) = (p_exhibitor_id IS NULL) THEN
    RAISE EXCEPTION 'ensure_exhibitor_public_identity: provide exactly one of legacy_exposant_id or exhibitor_id';
  END IF;

  -- ===================== CAS A : exposant legacy =====================
  IF p_legacy_exposant_id IS NOT NULL THEN
    -- 1) identité legacy/linked déjà présente pour CE legacy_exposant_id ?
    SELECT id INTO v_id FROM public.exhibitor_public_identities
      WHERE legacy_exposant_id = p_legacy_exposant_id LIMIT 1;
    IF v_id IS NOT NULL THEN RETURN v_id; END IF;

    -- 2) garde-fou "promotion" : id_exposant devenu un UUID exhibitor déjà identifié
    SELECT id INTO v_id FROM public.exhibitor_public_identities
      WHERE exhibitor_id::text = p_legacy_exposant_id LIMIT 1;
    IF v_id IS NOT NULL THEN RETURN v_id; END IF;

    -- 3) lien explicite legacy <-> modern via participation
    SELECT count(DISTINCT exhibitor_id), min(exhibitor_id)
      INTO v_link_count, v_linked_exhibitor
      FROM public.participation
      WHERE id_exposant = p_legacy_exposant_id AND exhibitor_id IS NOT NULL;

    IF v_link_count > 1 THEN
      RAISE EXCEPTION 'ensure_exhibitor_public_identity: ambiguous legacy link for "%" (% distinct exhibitors) - manual resolution required', p_legacy_exposant_id, v_link_count;
    END IF;

    IF v_link_count = 1 THEN
      -- l'exhibitor lié a-t-il déjà une identité ?
      SELECT id INTO v_id FROM public.exhibitor_public_identities
        WHERE exhibitor_id = v_linked_exhibitor LIMIT 1;
      IF v_id IS NOT NULL THEN
        -- transformer modern -> linked SANS changer le slug, uniquement si slot legacy libre
        UPDATE public.exhibitor_public_identities
          SET legacy_exposant_id = p_legacy_exposant_id,
              source_type = 'linked'
          WHERE id = v_id
            AND legacy_exposant_id IS NULL
            AND source_type = 'modern';

        -- Vérification de cohérence : ne jamais renvoyer une identité qui ne correspond pas.
        SELECT legacy_exposant_id, source_type INTO v_row_legacy, v_row_source
          FROM public.exhibitor_public_identities WHERE id = v_id;

        IF v_row_legacy = p_legacy_exposant_id THEN
          RETURN v_id; -- lien établi (ou déjà correct)
        ELSIF v_row_legacy IS NULL THEN
          RAISE EXCEPTION 'ensure_exhibitor_public_identity: identity % for exhibitor % is still modern/unlinked, cannot link to "%"', v_id, v_linked_exhibitor, p_legacy_exposant_id;
        ELSE
          RAISE EXCEPTION 'ensure_exhibitor_public_identity: identity % for exhibitor % is already linked to a different legacy "%" (requested "%")', v_id, v_linked_exhibitor, v_row_legacy, p_legacy_exposant_id;
        END IF;
      ELSE
        -- pas d'identité : créer une identité LINKED depuis l'exhibitor
        SELECT name, slug INTO v_name, v_existing_slug
          FROM public.exhibitors WHERE id = v_linked_exhibitor;
        IF v_name IS NOT NULL THEN
          v_base := public.exhibitor_slug_normalize(COALESCE(NULLIF(v_existing_slug, ''), v_name));
          IF v_base IS NULL OR v_base = '' THEN
            v_base := 'exposant-' || substr(md5(v_linked_exhibitor::text), 1, 8);
          END IF;
          RETURN public.exhibitor_identity_insert_safe(
                   p_legacy_exposant_id, v_linked_exhibitor, v_base, v_name, 'linked', false);
        END IF;
        -- l'exhibitor a disparu : on retombe sur une création legacy simple
      END IF;
    END IF;

    -- 4) création legacy simple (avec détection des familles de slugs existantes)
    SELECT nom_exposant, id INTO v_name, v_num_id
      FROM public.exposants WHERE id_exposant = p_legacy_exposant_id ORDER BY id LIMIT 1;
    IF v_name IS NULL THEN
      RAISE EXCEPTION 'ensure_exhibitor_public_identity: legacy exposant "%" not found', p_legacy_exposant_id;
    END IF;

    v_base := public.exhibitor_slug_normalize(v_name);
    IF v_base IS NULL OR v_base = '' THEN
      -- repli stable et unique -> pas de suffixage de famille
      v_base := CASE
                  WHEN v_num_id IS NOT NULL THEN 'exposant-' || v_num_id::text
                  ELSE 'exposant-' || substr(md5(p_legacy_exposant_id), 1, 8)
                END;
      v_force_suffix := false;
    ELSE
      -- ambigu si une famille de slugs (base ou base-N) existe déjà -> suffixer dès -1
      v_force_suffix := EXISTS (
        SELECT 1 FROM public.exhibitor_public_identities i
        WHERE i.public_slug = v_base
           OR i.public_slug ~ ('^' || v_base || '-[0-9]+$')
      );
    END IF;

    RETURN public.exhibitor_identity_insert_safe(
             p_legacy_exposant_id, NULL, v_base, v_name, 'legacy', v_force_suffix);
  END IF;

  -- ===================== CAS B : exhibitor modern =====================
  SELECT id INTO v_id FROM public.exhibitor_public_identities
    WHERE exhibitor_id = p_exhibitor_id LIMIT 1;
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;

  SELECT name, slug INTO v_name, v_existing_slug
    FROM public.exhibitors WHERE id = p_exhibitor_id;
  IF v_name IS NULL THEN
    RAISE EXCEPTION 'ensure_exhibitor_public_identity: exhibitor "%" not found', p_exhibitor_id;
  END IF;

  -- Modern : on réutilise/protège son slug propre (pas de suffixage de famille forcé)
  v_base := public.exhibitor_slug_normalize(COALESCE(NULLIF(v_existing_slug, ''), v_name));
  IF v_base IS NULL OR v_base = '' THEN
    v_base := 'exposant-' || substr(md5(p_exhibitor_id::text), 1, 8);
  END IF;
  RETURN public.exhibitor_identity_insert_safe(
           NULL, p_exhibitor_id, v_base, v_name, 'modern', false);
END;
$$;

-- 2) Fonction batch (système/cron uniquement).
CREATE OR REPLACE FUNCTION public.sync_exhibitor_public_identities(p_limit integer DEFAULT 5000)
RETURNS TABLE(created_modern integer, created_legacy integer, created_linked integer, skipped_ambiguous integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  rec record;
  v_modern integer := 0;
  v_legacy integer := 0;
  v_linked integer := 0;
  v_skip integer := 0;
  v_base text;
  v_slug text;
  v_ambiguous boolean;
BEGIN
  -- ---- 1) MODERN d'abord (slug existant préservé, prioritaire sur homonymes legacy)
  FOR rec IN
    SELECT e.id
    FROM public.exhibitors e
    WHERE NOT EXISTS (SELECT 1 FROM public.exhibitor_public_identities i WHERE i.exhibitor_id = e.id)
    LIMIT p_limit
  LOOP
    PERFORM public.ensure_exhibitor_public_identity(p_exhibitor_id => rec.id);
    v_modern := v_modern + 1;
  END LOOP;

  -- ---- 2) Candidats LEGACY (id_exposant distincts sans identité, non couverts par un UUID modern)
  DROP TABLE IF EXISTS _legacy_cand;
  CREATE TEMP TABLE _legacy_cand ON COMMIT DROP AS
  SELECT ex.id_exposant,
         min(ex.id) AS num_id,
         (array_agg(ex.nom_exposant ORDER BY ex.id))[1] AS nom
  FROM public.exposants ex
  WHERE ex.id_exposant IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.exhibitor_public_identities i  WHERE i.legacy_exposant_id = ex.id_exposant)
    AND NOT EXISTS (SELECT 1 FROM public.exhibitor_public_identities i2 WHERE i2.exhibitor_id::text = ex.id_exposant)
  GROUP BY ex.id_exposant
  LIMIT p_limit;

  ALTER TABLE _legacy_cand ADD COLUMN link_count integer;
  UPDATE _legacy_cand c
    SET link_count = (
      SELECT count(DISTINCT p.exhibitor_id)
      FROM public.participation p
      WHERE p.id_exposant = c.id_exposant AND p.exhibitor_id IS NOT NULL
    );

  -- 2a) liens uniques -> déléguer à ensure (transforme/crée linked, avec garde-fous)
  FOR rec IN SELECT id_exposant FROM _legacy_cand WHERE link_count = 1 LOOP
    BEGIN
      PERFORM public.ensure_exhibitor_public_identity(p_legacy_exposant_id => rec.id_exposant);
      v_linked := v_linked + 1;
    EXCEPTION WHEN others THEN
      v_skip := v_skip + 1;
    END;
  END LOOP;

  -- 2b) liens multiples -> ignorés et comptés (jamais de choix arbitraire)
  SELECT v_skip + count(*) INTO v_skip FROM _legacy_cand WHERE link_count > 1;

  -- 2c) legacy "pur" (aucun lien) -> suffixage de groupe cohérent avec la Phase 2A
  ALTER TABLE _legacy_cand ADD COLUMN base text;
  UPDATE _legacy_cand SET base = public.exhibitor_slug_normalize(nom) WHERE link_count = 0;

  FOR rec IN
    SELECT id_exposant, num_id, nom, base
    FROM _legacy_cand
    WHERE link_count = 0
    ORDER BY base NULLS LAST, num_id
  LOOP
    IF rec.base IS NULL OR rec.base = '' THEN
      -- repli stable et unique par exposant
      v_base := CASE
                  WHEN rec.num_id IS NOT NULL THEN 'exposant-' || rec.num_id::text
                  ELSE 'exposant-' || substr(md5(rec.id_exposant), 1, 8)
                END;
      v_slug := public.exhibitor_slug_next_available(v_base);
    ELSE
      -- ambigu si plusieurs nouveaux candidats partagent le base
      -- OU si une famille de slugs (base / base-N) existe déjà.
      v_ambiguous :=
        ( (SELECT count(*) FROM _legacy_cand c2 WHERE c2.link_count = 0 AND c2.base = rec.base) > 1 )
        OR EXISTS (
             SELECT 1 FROM public.exhibitor_public_identities i
             WHERE i.public_slug = rec.base
                OR i.public_slug ~ ('^' || rec.base || '-[0-9]+$')
           );
      IF v_ambiguous THEN
        v_slug := public.exhibitor_slug_next_available_from(rec.base, 1);
      ELSE
        v_slug := public.exhibitor_slug_next_available(rec.base);
      END IF;
    END IF;

    BEGIN
      INSERT INTO public.exhibitor_public_identities
        (legacy_exposant_id, exhibitor_id, public_slug, canonical_name, source_type, is_active)
      VALUES (rec.id_exposant, NULL, v_slug, rec.nom, 'legacy', true);
      v_legacy := v_legacy + 1;
    EXCEPTION WHEN unique_violation THEN
      -- course concurrente sur le slug -> chemin unitaire robuste
      PERFORM public.ensure_exhibitor_public_identity(p_legacy_exposant_id => rec.id_exposant);
      v_legacy := v_legacy + 1;
    END;
  END LOOP;

  created_modern    := v_modern;
  created_legacy    := v_legacy;
  created_linked    := v_linked;
  skipped_ambiguous := v_skip;
  RETURN NEXT;
END;
$$;

-- 3) Autorisation par GRANT uniquement (anon/authenticated exclus ; frontend ne peut pas appeler).
REVOKE ALL ON FUNCTION public.exhibitor_identity_insert_safe(text, uuid, text, text, text, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ensure_exhibitor_public_identity(text, uuid)                           FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_exhibitor_public_identities(integer)                              FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.exhibitor_identity_insert_safe(text, uuid, text, text, text, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.ensure_exhibitor_public_identity(text, uuid)                           TO service_role;
GRANT EXECUTE ON FUNCTION public.sync_exhibitor_public_identities(integer)                              TO service_role;

-- 4) Cron quotidien (SQL pur, aucun secret). S'exécute sous le rôle postgres (propriétaire).
DO $cron$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sync-exhibitor-public-identities') THEN
    PERFORM cron.unschedule('sync-exhibitor-public-identities');
  END IF;
  PERFORM cron.schedule(
    'sync-exhibitor-public-identities',
    '17 3 * * *',
    $job$ SELECT public.sync_exhibitor_public_identities(5000); $job$
  );
END
$cron$;