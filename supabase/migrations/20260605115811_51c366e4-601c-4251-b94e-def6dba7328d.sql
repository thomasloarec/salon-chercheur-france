
CREATE TABLE IF NOT EXISTS public._qa_cleaning_results (
  seq serial PRIMARY KEY,
  step text,
  label text,
  result jsonb
);
TRUNCATE public._qa_cleaning_results;
GRANT SELECT ON public._qa_cleaning_results TO PUBLIC;

DO $$
DECLARE
  admin_uid text := '7424675e-535a-433c-8baa-a4f55c92a91e';
  expA text := 'qa_test_a_001';
  expB text := 'qa_test_b_001';
  expC text := 'qa_test_c_001';
  expD text := 'qa_test_d_001';
  ev uuid[];
  r jsonb;
  v_before text;
  v_after text;
  events_before bigint;
  events_after bigint;
  other_part_before bigint;
  other_part_after bigint;
  idn_before bigint;
  idn_after bigint;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub',admin_uid,'role','authenticated')::text, true);

  SELECT array_agg(id) INTO ev FROM (SELECT id FROM events WHERE is_test = false ORDER BY date_debut DESC NULLS LAST LIMIT 5) q;

  SELECT count(*) INTO events_before FROM events;

  -- cleanup any prior synthetic rows
  DELETE FROM participation WHERE id_exposant IN (expA,expB,expC,expD);
  DELETE FROM exhibitor_public_identities WHERE legacy_exposant_id IN (expA,expB,expC,expD);
  DELETE FROM exposants WHERE id_exposant IN (expA,expB,expC,expD);

  INSERT INTO exposants(id_exposant,nom_exposant,website_exposant,normalized_domain) VALUES
    (expA,'QA Test A','agrispa.fr ',NULL),
    (expB,'QA Test B','https://qa-existing-domain-xyztest.fr','qa-existing-domain-xyztest.fr'),
    (expC,'QA Test C','qa-test-c.fr ',NULL),
    (expD,'QA Test D','qa-test-d.fr ',NULL);

  INSERT INTO exhibitor_public_identities(legacy_exposant_id,exhibitor_id,public_slug,canonical_name,source_type,is_active) VALUES
    (expA,NULL,'qa-test-a-001','QA Test A','legacy',true),
    (expB,NULL,'qa-test-b-001','QA Test B','legacy',true),
    (expC,NULL,'qa-test-c-001','QA Test C','legacy',true),
    (expD,NULL,'qa-test-d-001','QA Test D','legacy',true);

  INSERT INTO participation(id_exposant,id_event) SELECT expC, unnest(ev);
  INSERT INTO participation(id_exposant,id_event) VALUES (expD, ev[1]), (expD, ev[2]);

  SELECT count(*) INTO other_part_before FROM participation WHERE id_exposant NOT IN (expA,expB,expC,expD);
  SELECT count(*) INTO idn_before FROM exhibitor_public_identities WHERE is_active = true AND legacy_exposant_id NOT IN (expA,expB,expC,expD);

  -- ===================== B. Anti-doublon =====================
  SELECT website_exposant INTO v_before FROM exposants WHERE id_exposant = expA;
  r := public.admin_update_exhibitor_website(p_id_exposant := expA, p_new_website := 'qa-existing-domain-xyztest.fr', p_reason := 'QA-TEST B duplicate');
  SELECT website_exposant INTO v_after FROM exposants WHERE id_exposant = expA;
  INSERT INTO public._qa_cleaning_results(step,label,result) VALUES
    ('B','rpc_response', r),
    ('B','expA_website_unchanged', jsonb_build_object('before',v_before,'after',v_after,'unchanged',(v_before IS NOT DISTINCT FROM v_after))),
    ('B','audit_blocked_duplicate_count', to_jsonb((SELECT count(*) FROM admin_data_cleaning_logs WHERE action='update_exhibitor_website_blocked_duplicate' AND entity_id=expA)));

  -- ===================== C. Update unique =====================
  r := public.admin_update_exhibitor_website(p_id_exposant := expA, p_new_website := 'qa-unique-domain-7f3a2b.fr', p_reason := 'QA-TEST C unique');
  INSERT INTO public._qa_cleaning_results(step,label,result) VALUES
    ('C','rpc_response', r),
    ('C','exposant_row_after', (SELECT to_jsonb(x) FROM (SELECT website_exposant, normalized_domain FROM exposants WHERE id_exposant=expA) x)),
    ('C','still_in_invalid_list', to_jsonb((SELECT count(*) FROM public.list_invalid_exhibitor_websites() WHERE legacy_exposant_id=expA))),
    ('C','audit_update_count', to_jsonb((SELECT count(*) FROM admin_data_cleaning_logs WHERE action='update_exhibitor_website' AND entity_id=expA)));

  -- ===================== D. Preview removal (expC, 5 participations) =====================
  r := public.admin_preview_exhibitor_removal(p_id_exposant := expC);
  INSERT INTO public._qa_cleaning_results(step,label,result) VALUES ('D','preview_expC', r);

  -- ===================== E. Removal =====================
  -- E1: expD (<5) without reason -> must fail
  BEGIN
    r := public.admin_remove_exhibitor_from_site(p_id_exposant := expD, p_reason := NULL);
    INSERT INTO public._qa_cleaning_results(step,label,result) VALUES ('E','expD_no_reason_UNEXPECTED', r);
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public._qa_cleaning_results(step,label,result) VALUES ('E','expD_no_reason_blocked', jsonb_build_object('error',SQLERRM));
  END;
  -- E2: expD (<5) with reason -> removed
  r := public.admin_remove_exhibitor_from_site(p_id_exposant := expD, p_reason := 'QA-TEST E remove under 5');
  INSERT INTO public._qa_cleaning_results(step,label,result) VALUES
    ('E','expD_removed', r),
    ('E','expD_identity_active', to_jsonb((SELECT is_active FROM exhibitor_public_identities WHERE legacy_exposant_id=expD))),
    ('E','expD_participations_left', to_jsonb((SELECT count(*) FROM participation WHERE id_exposant=expD)));

  -- E3: expC (>=5) without confirm -> must fail
  BEGIN
    r := public.admin_remove_exhibitor_from_site(p_id_exposant := expC, p_reason := 'QA-TEST E remove 5 noconfirm');
    INSERT INTO public._qa_cleaning_results(step,label,result) VALUES ('E','expC_noconfirm_UNEXPECTED', r);
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public._qa_cleaning_results(step,label,result) VALUES ('E','expC_noconfirm_blocked', jsonb_build_object('error',SQLERRM));
  END;
  -- E4: expC (>=5) with confirm RETIRER -> removed
  r := public.admin_remove_exhibitor_from_site(p_id_exposant := expC, p_reason := 'QA-TEST E remove 5', p_confirm := 'RETIRER');
  INSERT INTO public._qa_cleaning_results(step,label,result) VALUES
    ('E','expC_removed', r),
    ('E','expC_identity_active', to_jsonb((SELECT is_active FROM exhibitor_public_identities WHERE legacy_exposant_id=expC))),
    ('E','expC_participations_left', to_jsonb((SELECT count(*) FROM participation WHERE id_exposant=expC))),
    ('E','audit_remove_count', to_jsonb((SELECT count(*) FROM admin_data_cleaning_logs WHERE action='remove_exhibitor_from_site' AND entity_id IN (expC,expD))));

  -- ===================== F. Admin gate at runtime (non-admin refused) =====================
  PERFORM set_config('request.jwt.claims', json_build_object('sub','00000000-0000-0000-0000-000000000000','role','authenticated')::text, true);
  BEGIN
    r := public.admin_update_exhibitor_website(p_id_exposant := expB, p_new_website := 'zzz-should-not.fr', p_reason := 'x');
    INSERT INTO public._qa_cleaning_results(step,label,result) VALUES ('F','nonadmin_UNEXPECTED', r);
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public._qa_cleaning_results(step,label,result) VALUES ('F','nonadmin_blocked', jsonb_build_object('error',SQLERRM));
  END;
  PERFORM set_config('request.jwt.claims', json_build_object('sub',admin_uid,'role','authenticated')::text, true);

  -- ===================== G. Non-regression =====================
  SELECT count(*) INTO events_after FROM events;
  SELECT count(*) INTO other_part_after FROM participation WHERE id_exposant NOT IN (expA,expB,expC,expD);
  SELECT count(*) INTO idn_after FROM exhibitor_public_identities WHERE is_active = true AND legacy_exposant_id NOT IN (expA,expB,expC,expD);
  INSERT INTO public._qa_cleaning_results(step,label,result) VALUES
    ('G','events_count', jsonb_build_object('before',events_before,'after',events_after,'unchanged',(events_before=events_after))),
    ('G','other_participations', jsonb_build_object('before',other_part_before,'after',other_part_after,'unchanged',(other_part_before=other_part_after))),
    ('G','other_active_identities', jsonb_build_object('before',idn_before,'after',idn_after,'unchanged',(idn_before=idn_after)));

  -- ===================== CLEANUP synthetic =====================
  DELETE FROM participation WHERE id_exposant IN (expA,expB,expC,expD);
  DELETE FROM exhibitor_public_identities WHERE legacy_exposant_id IN (expA,expB,expC,expD);
  DELETE FROM exposants WHERE id_exposant IN (expA,expB,expC,expD);
  DELETE FROM admin_data_cleaning_logs WHERE entity_id IN (expA,expB,expC,expD) OR reason LIKE 'QA-TEST%';
END $$;
