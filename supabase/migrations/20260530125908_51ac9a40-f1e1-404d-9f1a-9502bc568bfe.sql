CREATE OR REPLACE FUNCTION public._t2abis_run_tests()
RETURNS TABLE(test text, result text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_m1 uuid;
  v_m2 uuid;
  v_id uuid;
  v_id2 uuid;
  v_cnt integer;
  v_slug text;
  v_src text;
  v_leg text;
  v_existing_legacy text;
  v_existing_before text;  -- snapshot du slug existant (hors test)
  v_before text;           -- usage générique (slug modern avant transformation)
  v_after text;
BEGIN
  -- ============ CLEANUP initial : supprimer d'éventuels résidus ============
  DELETE FROM public.exhibitor_public_identities
    WHERE legacy_exposant_id LIKE '\_\_t2abis%'
       OR public_slug LIKE 't2abis-%'
       OR canonical_name LIKE '\_\_T2ABIS%'
       OR canonical_name IN ('T2ABIS Siemens','T2ABIS Groupe Test')
       OR exhibitor_id IN (SELECT id FROM public.exhibitors WHERE name LIKE '\_\_T2ABIS%');
  DELETE FROM public.participation WHERE id_exposant LIKE '\_\_t2abis%';
  DELETE FROM public.exhibitors WHERE name LIKE '\_\_T2ABIS%';
  DELETE FROM public.exposants WHERE id_exposant LIKE '\_\_t2abis%';

  -- snapshot d'un slug existant (hors test) pour vérifier la non-modification
  SELECT legacy_exposant_id, public_slug INTO v_existing_legacy, v_existing_before
  FROM public.exhibitor_public_identities
  WHERE source_type = 'legacy' AND legacy_exposant_id NOT LIKE '\_\_t2abis%'
  ORDER BY created_at LIMIT 1;

  BEGIN
    -- ============ TEST 1 : legacy existant déjà identifié -> no-op ============
    SELECT public.ensure_exhibitor_public_identity(p_legacy_exposant_id => v_existing_legacy) INTO v_id;
    SELECT count(*) INTO v_cnt FROM public.exhibitor_public_identities WHERE legacy_exposant_id = v_existing_legacy;
    test := 'T1 legacy existant -> no-op'; result := CASE WHEN v_cnt = 1 THEN 'PASS' ELSE 'FAIL count='||v_cnt END; RETURN NEXT;

    -- ============ TEST 2 : nouveau legacy de test -> identité créée ============
    INSERT INTO public.exposants(id_exposant, nom_exposant) VALUES ('__t2abis_legacy_a', '__T2ABIS Robot Coupe');
    SELECT public.ensure_exhibitor_public_identity(p_legacy_exposant_id => '__t2abis_legacy_a') INTO v_id;
    SELECT count(*), max(public_slug) INTO v_cnt, v_slug FROM public.exhibitor_public_identities WHERE legacy_exposant_id = '__t2abis_legacy_a';
    test := 'T2 nouveau legacy -> identité créée'; result := CASE WHEN v_cnt = 1 AND v_slug IS NOT NULL THEN 'PASS slug='||v_slug ELSE 'FAIL' END; RETURN NEXT;

    -- ============ TEST 3 : 2e appel sur le même -> pas de doublon ============
    SELECT public.ensure_exhibitor_public_identity(p_legacy_exposant_id => '__t2abis_legacy_a') INTO v_id2;
    SELECT count(*) INTO v_cnt FROM public.exhibitor_public_identities WHERE legacy_exposant_id = '__t2abis_legacy_a';
    test := 'T3 2e appel -> pas de doublon'; result := CASE WHEN v_cnt = 1 AND v_id = v_id2 THEN 'PASS' ELSE 'FAIL count='||v_cnt END; RETURN NEXT;

    -- ============ TEST 4 : modern existant déjà identifié -> no-op ============
    INSERT INTO public.exhibitors(name) VALUES ('__T2ABIS Modern Co') RETURNING id INTO v_m1;
    SELECT public.ensure_exhibitor_public_identity(p_exhibitor_id => v_m1) INTO v_id;
    SELECT public.ensure_exhibitor_public_identity(p_exhibitor_id => v_m1) INTO v_id2;
    SELECT count(*) INTO v_cnt FROM public.exhibitor_public_identities WHERE exhibitor_id = v_m1;
    test := 'T4 modern existant -> no-op'; result := CASE WHEN v_cnt = 1 AND v_id = v_id2 THEN 'PASS' ELSE 'FAIL count='||v_cnt END; RETURN NEXT;

    -- ============ TEST 5 : nouveau modern -> identité modern créée ============
    SELECT source_type INTO v_src FROM public.exhibitor_public_identities WHERE exhibitor_id = v_m1;
    test := 'T5 nouveau modern -> source modern'; result := CASE WHEN v_src = 'modern' THEN 'PASS' ELSE 'FAIL src='||v_src END; RETURN NEXT;

    -- ============ TEST 6 : collision de famille de slugs (siemens-1..4) ============
    INSERT INTO public.exhibitor_public_identities(legacy_exposant_id, public_slug, canonical_name, source_type)
    VALUES ('__t2abis_sie_1','t2abis-siemens-1','__T2ABIS Siemens','legacy'),
           ('__t2abis_sie_2','t2abis-siemens-2','__T2ABIS Siemens','legacy'),
           ('__t2abis_sie_3','t2abis-siemens-3','__T2ABIS Siemens','legacy'),
           ('__t2abis_sie_4','t2abis-siemens-4','__T2ABIS Siemens','legacy');
    INSERT INTO public.exposants(id_exposant, nom_exposant) VALUES ('__t2abis_sie_new', 'T2ABIS Siemens');
    SELECT public.ensure_exhibitor_public_identity(p_legacy_exposant_id => '__t2abis_sie_new') INTO v_id;
    SELECT public_slug INTO v_slug FROM public.exhibitor_public_identities WHERE legacy_exposant_id = '__t2abis_sie_new';
    test := 'T6 famille existante -> suffixe dès -5 (jamais nu)';
    result := CASE WHEN v_slug = 't2abis-siemens-5' THEN 'PASS slug='||v_slug ELSE 'FAIL slug='||COALESCE(v_slug,'NULL') END; RETURN NEXT;

    -- ============ TEST 7 : modern déjà linked au BON legacy ============
    INSERT INTO public.exhibitors(name) VALUES ('__T2ABIS Linked Co') RETURNING id INTO v_m2;
    PERFORM public.ensure_exhibitor_public_identity(p_exhibitor_id => v_m2);          -- crée identité modern
    SELECT public_slug INTO v_before FROM public.exhibitor_public_identities WHERE exhibitor_id = v_m2;
    INSERT INTO public.participation(id_exposant, exhibitor_id) VALUES ('__t2abis_legacy_b', v_m2);
    INSERT INTO public.exposants(id_exposant, nom_exposant) VALUES ('__t2abis_legacy_b','__T2ABIS Legacy B');
    SELECT public.ensure_exhibitor_public_identity(p_legacy_exposant_id => '__t2abis_legacy_b') INTO v_id;
    SELECT source_type, legacy_exposant_id, public_slug INTO v_src, v_leg, v_after
      FROM public.exhibitor_public_identities WHERE exhibitor_id = v_m2;
    test := 'T7 modern -> linked (bon legacy, slug inchangé)';
    result := CASE WHEN v_src='linked' AND v_leg='__t2abis_legacy_b' AND v_after = v_before
                   THEN 'PASS slug='||v_after ELSE 'FAIL src='||v_src||' leg='||COALESCE(v_leg,'NULL')||' slug='||v_after END; RETURN NEXT;

    -- T7b : ré-appel idempotent
    SELECT public.ensure_exhibitor_public_identity(p_legacy_exposant_id => '__t2abis_legacy_b') INTO v_id2;
    test := 'T7b ré-appel linked -> idempotent';
    result := CASE WHEN v_id = v_id2 THEN 'PASS' ELSE 'FAIL' END; RETURN NEXT;

    -- ============ TEST 8 : modern déjà linked à un AUTRE legacy -> erreur ============
    INSERT INTO public.participation(id_exposant, exhibitor_id) VALUES ('__t2abis_legacy_c', v_m2);
    INSERT INTO public.exposants(id_exposant, nom_exposant) VALUES ('__t2abis_legacy_c','__T2ABIS Legacy C');
    BEGIN
      PERFORM public.ensure_exhibitor_public_identity(p_legacy_exposant_id => '__t2abis_legacy_c');
      test := 'T8 linked à un autre legacy -> erreur'; result := 'FAIL (no exception)'; RETURN NEXT;
    EXCEPTION WHEN others THEN
      test := 'T8 linked à un autre legacy -> erreur'; result := 'PASS ('||left(SQLERRM,60)||')'; RETURN NEXT;
    END;

    -- ============ TEST 9 : batch sync (modern + groupe legacy ambigu) ============
    INSERT INTO public.exhibitors(name) VALUES ('__T2ABIS Batch Modern');  -- sans identité
    INSERT INTO public.exposants(id_exposant, nom_exposant) VALUES
      ('__t2abis_grp_1','T2ABIS Groupe Test'),
      ('__t2abis_grp_2','T2ABIS Groupe Test');  -- même base, groupe ambigu
    PERFORM public.sync_exhibitor_public_identities(2000);
    SELECT array_to_string(array_agg(public_slug ORDER BY public_slug), ',') INTO v_slug
      FROM public.exhibitor_public_identities WHERE legacy_exposant_id IN ('__t2abis_grp_1','__t2abis_grp_2');
    test := 'T9 batch groupe ambigu -> -1/-2';
    result := CASE WHEN v_slug = 't2abis-groupe-test-1,t2abis-groupe-test-2' THEN 'PASS slug='||v_slug ELSE 'FAIL slug='||COALESCE(v_slug,'NULL') END; RETURN NEXT;
    SELECT count(*) INTO v_cnt FROM public.exhibitor_public_identities i
      JOIN public.exhibitors e ON e.id = i.exhibitor_id
      WHERE e.name = '__T2ABIS Batch Modern' AND i.source_type='modern';
    test := 'T9b batch modern sans identité -> créé'; result := CASE WHEN v_cnt = 1 THEN 'PASS' ELSE 'FAIL count='||v_cnt END; RETURN NEXT;

    -- ============ TEST 10 : slug existant non modifié (comparé au snapshot) ============
    SELECT public_slug INTO v_after FROM public.exhibitor_public_identities WHERE legacy_exposant_id = v_existing_legacy;
    test := 'T10 slug existant inchangé';
    result := CASE WHEN v_after = v_existing_before
                   THEN 'PASS (unchanged='||v_after||')'
                   ELSE 'FAIL before='||COALESCE(v_existing_before,'NULL')||' after='||COALESCE(v_after,'NULL') END; RETURN NEXT;

    -- ============ CLEANUP final (succès) ============
    DELETE FROM public.exhibitor_public_identities
      WHERE legacy_exposant_id LIKE '\_\_t2abis%'
         OR public_slug LIKE 't2abis-%'
         OR canonical_name LIKE '\_\_T2ABIS%'
         OR canonical_name IN ('T2ABIS Siemens','T2ABIS Groupe Test')
         OR exhibitor_id IN (SELECT id FROM public.exhibitors WHERE name LIKE '\_\_T2ABIS%');
    DELETE FROM public.participation WHERE id_exposant LIKE '\_\_t2abis%';
    DELETE FROM public.exhibitors WHERE name LIKE '\_\_T2ABIS%';
    DELETE FROM public.exposants WHERE id_exposant LIKE '\_\_t2abis%';

    SELECT count(*) INTO v_cnt FROM public.exhibitor_public_identities
      WHERE legacy_exposant_id LIKE '\_\_t2abis%' OR public_slug LIKE 't2abis-%' OR canonical_name LIKE '\_\_T2ABIS%';
    test := 'CLEANUP données de test supprimées'; result := CASE WHEN v_cnt = 0 THEN 'PASS' ELSE 'FAIL reste='||v_cnt END; RETURN NEXT;

  EXCEPTION WHEN others THEN
    -- ============ CLEANUP garanti en cas d'erreur, puis relance ============
    DELETE FROM public.exhibitor_public_identities
      WHERE legacy_exposant_id LIKE '\_\_t2abis%'
         OR public_slug LIKE 't2abis-%'
         OR canonical_name LIKE '\_\_T2ABIS%'
         OR canonical_name IN ('T2ABIS Siemens','T2ABIS Groupe Test')
         OR exhibitor_id IN (SELECT id FROM public.exhibitors WHERE name LIKE '\_\_T2ABIS%');
    DELETE FROM public.participation WHERE id_exposant LIKE '\_\_t2abis%';
    DELETE FROM public.exhibitors WHERE name LIKE '\_\_T2ABIS%';
    DELETE FROM public.exposants WHERE id_exposant LIKE '\_\_t2abis%';
    RAISE;
  END;
END;
$$;

-- Exécution réservée au rôle système uniquement (anon/authenticated exclus).
REVOKE ALL ON FUNCTION public._t2abis_run_tests() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._t2abis_run_tests() TO service_role;