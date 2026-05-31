DO $$
DECLARE
  v_ex uuid;
  v_cnt int;
  v_desc text;
BEGIN
  -- Exposant jetable (is_test)
  INSERT INTO public.exhibitors(name, is_test, description)
  VALUES ('__audit_test_4ad_v2__', true, 'OLD')
  RETURNING id INTO v_ex;

  -- Preuve : aucune identité publique créée automatiquement à l'insertion
  SELECT count(*) INTO v_cnt FROM public.exhibitor_public_identities WHERE exhibitor_id = v_ex;
  IF v_cnt <> 0 THEN RAISE EXCEPTION 'PROOF_FAILED_identity_auto_created (count=%)', v_cnt; END IF;

  -- Test 9 : changed_fields vide refusé
  BEGIN
    PERFORM public.update_exhibitor_public_profile_with_log(v_ex, gen_random_uuid(), 'platform_admin',
      '{"website":"https://x.fr/"}'::jsonb, ARRAY[]::text[],
      '{"website":{"old":null,"new":"https://x.fr/"}}'::jsonb);
    RAISE EXCEPTION 'TEST09_NOT_REJECTED';
  EXCEPTION WHEN others THEN
    IF SQLERRM = 'TEST09_NOT_REJECTED' THEN RAISE; END IF;
    IF strpos(SQLERRM, 'changed_fields must not be empty') = 0 THEN
      RAISE EXCEPTION 'TEST09_WRONG_ERROR: %', SQLERRM; END IF;
  END;

  -- Test 10 : doublon dans changed_fields refusé
  BEGIN
    PERFORM public.update_exhibitor_public_profile_with_log(v_ex, gen_random_uuid(), 'platform_admin',
      '{"website":"https://x.fr/"}'::jsonb, ARRAY['website','website'],
      '{"website":{"old":null,"new":"https://x.fr/"}}'::jsonb);
    RAISE EXCEPTION 'TEST10_NOT_REJECTED';
  EXCEPTION WHEN others THEN
    IF SQLERRM = 'TEST10_NOT_REJECTED' THEN RAISE; END IF;
    IF strpos(SQLERRM, 'changed_fields must not contain duplicates') = 0 THEN
      RAISE EXCEPTION 'TEST10_WRONG_ERROR: %', SQLERRM; END IF;
  END;

  -- Test 11 : p_update avec clé hors whitelist refusé
  BEGIN
    PERFORM public.update_exhibitor_public_profile_with_log(v_ex, gen_random_uuid(), 'platform_admin',
      '{"website":"https://x.fr/","name":"hack"}'::jsonb, ARRAY['website'],
      '{"website":{"old":null,"new":"https://x.fr/"}}'::jsonb);
    RAISE EXCEPTION 'TEST11_NOT_REJECTED';
  EXCEPTION WHEN others THEN
    IF SQLERRM = 'TEST11_NOT_REJECTED' THEN RAISE; END IF;
    IF strpos(SQLERRM, 'p_update contains a non-whitelisted key') = 0 THEN
      RAISE EXCEPTION 'TEST11_WRONG_ERROR: %', SQLERRM; END IF;
  END;

  -- Test 12 : p_changes avec clé hors whitelist refusé
  BEGIN
    PERFORM public.update_exhibitor_public_profile_with_log(v_ex, gen_random_uuid(), 'platform_admin',
      '{"website":"https://x.fr/"}'::jsonb, ARRAY['website'],
      '{"website":{"old":null,"new":"https://x.fr/"},"name":{"old":null,"new":"hack"}}'::jsonb);
    RAISE EXCEPTION 'TEST12_NOT_REJECTED';
  EXCEPTION WHEN others THEN
    IF SQLERRM = 'TEST12_NOT_REJECTED' THEN RAISE; END IF;
    IF strpos(SQLERRM, 'p_changes contains a non-whitelisted key') = 0 THEN
      RAISE EXCEPTION 'TEST12_WRONG_ERROR: %', SQLERRM; END IF;
  END;

  -- Test 13 : incohérence p_update / p_changed_fields refusée
  BEGIN
    PERFORM public.update_exhibitor_public_profile_with_log(v_ex, gen_random_uuid(), 'platform_admin',
      '{"website":"https://x.fr/"}'::jsonb, ARRAY['description'],
      '{"description":{"old":"OLD","new":"NEW"}}'::jsonb);
    RAISE EXCEPTION 'TEST13_NOT_REJECTED';
  EXCEPTION WHEN others THEN
    IF SQLERRM = 'TEST13_NOT_REJECTED' THEN RAISE; END IF;
    IF strpos(SQLERRM, 'p_update keys must all be present in p_changed_fields') = 0 THEN
      RAISE EXCEPTION 'TEST13_WRONG_ERROR: %', SQLERRM; END IF;
  END;

  -- Test 14a : structure changes scalaire (sans old/new) refusée
  BEGIN
    PERFORM public.update_exhibitor_public_profile_with_log(v_ex, gen_random_uuid(), 'platform_admin',
      '{"website":"https://x.fr/"}'::jsonb, ARRAY['website'],
      '{"website":"https://x.fr/"}'::jsonb);
    RAISE EXCEPTION 'TEST14A_NOT_REJECTED';
  EXCEPTION WHEN others THEN
    IF SQLERRM = 'TEST14A_NOT_REJECTED' THEN RAISE; END IF;
    IF strpos(SQLERRM, 'must be a json object with old/new') = 0 THEN
      RAISE EXCEPTION 'TEST14A_WRONG_ERROR: %', SQLERRM; END IF;
  END;

  -- Test 14b : structure changes {before,after} refusée
  BEGIN
    PERFORM public.update_exhibitor_public_profile_with_log(v_ex, gen_random_uuid(), 'platform_admin',
      '{"website":"https://x.fr/"}'::jsonb, ARRAY['website'],
      '{"website":{"before":null,"after":"https://x.fr/"}}'::jsonb);
    RAISE EXCEPTION 'TEST14B_NOT_REJECTED';
  EXCEPTION WHEN others THEN
    IF SQLERRM = 'TEST14B_NOT_REJECTED' THEN RAISE; END IF;
    IF strpos(SQLERRM, 'must contain both old and new keys') = 0 THEN
      RAISE EXCEPTION 'TEST14B_WRONG_ERROR: %', SQLERRM; END IF;
  END;

  -- Test 15 : modification valide acceptée + log créé
  PERFORM public.update_exhibitor_public_profile_with_log(v_ex, gen_random_uuid(), 'platform_admin',
    '{"description":"NEW"}'::jsonb, ARRAY['description'],
    '{"description":{"old":"OLD","new":"NEW"}}'::jsonb);
  SELECT count(*) INTO v_cnt FROM public.exhibitor_profile_change_logs WHERE exhibitor_id = v_ex;
  IF v_cnt <> 1 THEN RAISE EXCEPTION 'TEST15_FAILED_no_log (count=%)', v_cnt; END IF;
  SELECT description INTO v_desc FROM public.exhibitors WHERE id = v_ex;
  IF v_desc <> 'NEW' THEN RAISE EXCEPTION 'TEST15_FAILED_no_update (desc=%)', v_desc; END IF;

  -- Test 16 : échec insert log (actor_role invalide) -> rollback atomique de l'UPDATE
  BEGIN
    PERFORM public.update_exhibitor_public_profile_with_log(v_ex, gen_random_uuid(), 'INVALID_ROLE',
      '{"description":"SHOULD_ROLLBACK"}'::jsonb, ARRAY['description'],
      '{"description":{"old":"NEW","new":"SHOULD_ROLLBACK"}}'::jsonb);
    RAISE EXCEPTION 'TEST16_NOT_REJECTED';
  EXCEPTION WHEN others THEN
    IF SQLERRM = 'TEST16_NOT_REJECTED' THEN RAISE; END IF;
    IF strpos(SQLERRM, 'exhibitor_change_actor_role_check') = 0
       AND strpos(SQLERRM, 'violates check constraint') = 0 THEN
      RAISE EXCEPTION 'TEST16_WRONG_ERROR: %', SQLERRM; END IF;
  END;
  SELECT description INTO v_desc FROM public.exhibitors WHERE id = v_ex;
  IF v_desc <> 'NEW' THEN RAISE EXCEPTION 'TEST16_FAILED_not_rolled_back (desc=%)', v_desc; END IF;
  SELECT count(*) INTO v_cnt FROM public.exhibitor_profile_change_logs WHERE exhibitor_id = v_ex;
  IF v_cnt <> 1 THEN RAISE EXCEPTION 'TEST16_FAILED_extra_log (count=%)', v_cnt; END IF;

  -- Nettoyage : supprimer logs puis exposant (cascade)
  DELETE FROM public.exhibitor_profile_change_logs WHERE exhibitor_id = v_ex;
  DELETE FROM public.exhibitor_public_identities WHERE exhibitor_id = v_ex;
  DELETE FROM public.exhibitors WHERE id = v_ex;

  -- Vérifications finales de nettoyage
  IF EXISTS (SELECT 1 FROM public.exhibitors WHERE id = v_ex) THEN
    RAISE EXCEPTION 'CLEANUP_FAILED_exhibitor_remains'; END IF;
  IF EXISTS (SELECT 1 FROM public.exhibitor_profile_change_logs WHERE exhibitor_id = v_ex) THEN
    RAISE EXCEPTION 'CLEANUP_FAILED_logs_remain'; END IF;
  IF EXISTS (SELECT 1 FROM public.exhibitor_public_identities WHERE exhibitor_id = v_ex) THEN
    RAISE EXCEPTION 'CLEANUP_FAILED_identities_remain'; END IF;

  RAISE NOTICE 'ALL_AUDIT_TESTS_PASSED_V2';
END $$;