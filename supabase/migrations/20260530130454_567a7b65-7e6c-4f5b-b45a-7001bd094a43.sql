CREATE OR REPLACE FUNCTION public.ensure_exhibitor_public_identity(p_legacy_exposant_id text DEFAULT NULL::text, p_exhibitor_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
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
    SELECT count(DISTINCT exhibitor_id), (array_agg(DISTINCT exhibitor_id))[1]
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
$function$;