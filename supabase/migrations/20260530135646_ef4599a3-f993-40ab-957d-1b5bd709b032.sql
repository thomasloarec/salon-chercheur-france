DO $$
DECLARE
  v_slug text;
  v_inactive_slug text;
  v_test_run_id text;
  v_count int;
BEGIN
  v_test_run_id := 'phase2d-test-' || gen_random_uuid()::text;

  SELECT public_slug INTO v_slug
  FROM public.exhibitor_public_identities
  WHERE is_active = true
  LIMIT 1;

  IF v_slug IS NULL THEN
    RAISE EXCEPTION 'TEST SETUP FAILED: no active identity found';
  END IF;

  SELECT public_slug INTO v_inactive_slug
  FROM public.exhibitor_public_identities
  WHERE is_active = false
  LIMIT 1;

  -- A. Valid events -> TRUE, each carrying the unique test_run_id
  IF public.track_exhibitor_event(v_slug, 'profile_view',
        jsonb_build_object('source_surface','page','test_run_id',v_test_run_id)) IS NOT TRUE
    THEN RAISE EXCEPTION 'FAIL: profile_view'; END IF;
  IF public.track_exhibitor_event(v_slug, 'website_click',
        jsonb_build_object('target_url','https://x.com','test_run_id',v_test_run_id)) IS NOT TRUE
    THEN RAISE EXCEPTION 'FAIL: website_click'; END IF;
  IF public.track_exhibitor_event(v_slug, 'linkedin_click',
        jsonb_build_object('test_run_id',v_test_run_id)) IS NOT TRUE
    THEN RAISE EXCEPTION 'FAIL: linkedin_click'; END IF;
  IF public.track_exhibitor_event(v_slug, 'full_profile_click',
        jsonb_build_object('source_surface','drawer','test_run_id',v_test_run_id)) IS NOT TRUE
    THEN RAISE EXCEPTION 'FAIL: full_profile_click'; END IF;
  IF public.track_exhibitor_event(v_slug, 'alert_activate',
        jsonb_build_object('test_run_id',v_test_run_id)) IS NOT TRUE
    THEN RAISE EXCEPTION 'FAIL: alert_activate'; END IF;
  IF public.track_exhibitor_event(v_slug, 'alert_deactivate',
        jsonb_build_object('test_run_id',v_test_run_id)) IS NOT TRUE
    THEN RAISE EXCEPTION 'FAIL: alert_deactivate'; END IF;
  IF public.track_exhibitor_event(v_slug, 'brochure_download',
        jsonb_build_object('novelty_id','abc','test_run_id',v_test_run_id)) IS NOT TRUE
    THEN RAISE EXCEPTION 'FAIL: brochure_download'; END IF;

  -- B. Rejected cases -> FALSE (no row inserted)
  IF public.track_exhibitor_event(v_slug, 'alert_click',
        jsonb_build_object('test_run_id',v_test_run_id)) IS NOT FALSE
    THEN RAISE EXCEPTION 'FAIL: invalid event_type should return false'; END IF;
  IF public.track_exhibitor_event('zzz-does-not-exist-999', 'profile_view',
        jsonb_build_object('test_run_id',v_test_run_id)) IS NOT FALSE
    THEN RAISE EXCEPTION 'FAIL: unknown slug should return false'; END IF;
  IF public.track_exhibitor_event(NULL, 'profile_view',
        jsonb_build_object('test_run_id',v_test_run_id)) IS NOT FALSE
    THEN RAISE EXCEPTION 'FAIL: null slug should return false'; END IF;
  IF v_inactive_slug IS NOT NULL THEN
    IF public.track_exhibitor_event(v_inactive_slug, 'profile_view',
          jsonb_build_object('test_run_id',v_test_run_id)) IS NOT FALSE
      THEN RAISE EXCEPTION 'FAIL: inactive slug should return false'; END IF;
  END IF;
  IF public.track_exhibitor_event(v_slug, 'profile_view', '[1,2,3]'::jsonb) IS NOT FALSE
    THEN RAISE EXCEPTION 'FAIL: array metadata should return false'; END IF;
  IF public.track_exhibitor_event(v_slug, 'profile_view', '42'::jsonb) IS NOT FALSE
    THEN RAISE EXCEPTION 'FAIL: scalar metadata should return false'; END IF;

  -- C. Assertions filtered EXCLUSIVELY by test_run_id
  SELECT count(*) INTO v_count FROM public.exhibitor_events
  WHERE metadata->>'test_run_id' = v_test_run_id;
  IF v_count <> 7 THEN RAISE EXCEPTION 'FAIL: expected exactly 7 test events, got %', v_count; END IF;

  SELECT count(*) INTO v_count FROM public.exhibitor_events
  WHERE metadata->>'test_run_id' = v_test_run_id AND public_slug = v_slug;
  IF v_count <> 7 THEN RAISE EXCEPTION 'FAIL: public_slug not stored correctly (%/7)', v_count; END IF;

  SELECT count(*) INTO v_count FROM public.exhibitor_events
  WHERE metadata->>'test_run_id' = v_test_run_id AND user_id IS NOT NULL;
  IF v_count <> 0 THEN RAISE EXCEPTION 'FAIL: user_id should be NULL for anon, found %', v_count; END IF;

  SELECT count(*) INTO v_count FROM public.exhibitor_events
  WHERE metadata->>'test_run_id' = v_test_run_id AND public_identity_id IS NULL;
  IF v_count <> 0 THEN RAISE EXCEPTION 'FAIL: public_identity_id should be resolved, found % null', v_count; END IF;

  -- D. Grants / access confirmations (catalog-level)
  IF has_function_privilege('anon','public.track_exhibitor_event(text,text,jsonb)','EXECUTE') IS NOT TRUE
    THEN RAISE EXCEPTION 'FAIL: anon cannot EXECUTE track_exhibitor_event'; END IF;
  IF has_function_privilege('authenticated','public.track_exhibitor_event(text,text,jsonb)','EXECUTE') IS NOT TRUE
    THEN RAISE EXCEPTION 'FAIL: authenticated cannot EXECUTE track_exhibitor_event'; END IF;
  IF has_function_privilege('service_role','public.track_exhibitor_event(text,text,jsonb)','EXECUTE') IS NOT TRUE
    THEN RAISE EXCEPTION 'FAIL: service_role cannot EXECUTE track_exhibitor_event'; END IF;
  IF has_table_privilege('anon','public.exhibitor_events','SELECT') IS NOT FALSE
    THEN RAISE EXCEPTION 'FAIL: anon must not have direct SELECT'; END IF;
  IF has_table_privilege('anon','public.exhibitor_events','INSERT') IS NOT FALSE
    THEN RAISE EXCEPTION 'FAIL: anon must not have direct INSERT'; END IF;
  IF has_table_privilege('authenticated','public.exhibitor_events','SELECT') IS NOT TRUE
    THEN RAISE EXCEPTION 'FAIL: authenticated needs table SELECT (RLS restricts rows to admins)'; END IF;
  IF has_table_privilege('authenticated','public.exhibitor_events','INSERT') IS NOT FALSE
    THEN RAISE EXCEPTION 'FAIL: authenticated must not have direct INSERT'; END IF;
  IF has_table_privilege('service_role','public.exhibitor_events','SELECT') IS NOT TRUE
    THEN RAISE EXCEPTION 'FAIL: service_role must manage table'; END IF;

  -- E. Cleanup STRICTLY by test_run_id
  DELETE FROM public.exhibitor_events WHERE metadata->>'test_run_id' = v_test_run_id;

  -- Final: 0 test rows remaining
  SELECT count(*) INTO v_count FROM public.exhibitor_events
  WHERE metadata->>'test_run_id' = v_test_run_id;
  IF v_count <> 0 THEN RAISE EXCEPTION 'FAIL: cleanup incomplete, % remain', v_count; END IF;

  RAISE NOTICE 'ALL PHASE 2D TESTS PASSED (run %): inserts OK, rejects OK, grants OK, cleanup OK (0 remaining)', v_test_run_id;
END $$;