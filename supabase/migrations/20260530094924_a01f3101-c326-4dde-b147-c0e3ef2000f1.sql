-- =====================================================================
-- PHASE 1C — TEST DE SÉCURITÉ NON DESTRUCTIF — V3 (fix harnais TEST4)
-- =====================================================================
DO $$
DECLARE
  v_user      uuid := '55e3c31a-95b8-4afa-8404-114b018746a4';
  v_exhibitor uuid := '90509172-96d3-43dc-8302-8651ecb526f6';
  v_event     uuid;
  v_temp_ids  uuid[] := '{}';
  v_draft     uuid;
  v_status    text;
  v_caught    text;
  v_is_admin  boolean;
  v_is_mgr    boolean;
  v_visible   boolean;
  v_evt_test  boolean;
  v_jwt       text;
  v_jwt_svc   text;
BEGIN
  v_jwt     := json_build_object('sub', v_user, 'role', 'authenticated')::text;
  v_jwt_svc := json_build_object('role', 'service_role')::text;

  -- 0) PRÉFLIGHT
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = v_user) THEN
    RAISE EXCEPTION 'PREFLIGHT FAIL: v_user % introuvable', v_user;
  END IF;

  SELECT EXISTS (SELECT 1 FROM user_roles WHERE user_id = v_user AND role = 'admin')
    INTO v_is_admin;
  IF v_is_admin THEN
    RAISE EXCEPTION 'PREFLIGHT FAIL: v_user est admin';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM exhibitors WHERE id = v_exhibitor) THEN
    RAISE EXCEPTION 'PREFLIGHT FAIL: v_exhibitor % introuvable', v_exhibitor;
  END IF;

  SELECT (
    EXISTS (SELECT 1 FROM exhibitor_team_members
            WHERE exhibitor_id = v_exhibitor AND user_id = v_user
              AND status = 'active' AND role IN ('owner','admin'))
    OR EXISTS (SELECT 1 FROM exhibitors
               WHERE id = v_exhibitor AND owner_user_id = v_user)
  ) INTO v_is_mgr;
  IF NOT v_is_mgr THEN
    RAISE EXCEPTION 'PREFLIGHT FAIL: v_user n''est ni owner ni gestionnaire actif de v_exhibitor';
  END IF;

  SELECT e.id, e.visible, e.is_test
    INTO v_event, v_visible, v_evt_test
  FROM events e
  JOIN participation p ON p.id_event = e.id
  WHERE p.exhibitor_id = v_exhibitor
    AND e.visible = true AND e.is_test = false
  LIMIT 1;

  IF v_event IS NULL THEN
    SELECT e.id, e.visible, e.is_test
      INTO v_event, v_visible, v_evt_test
    FROM events e
    JOIN novelties n ON n.event_id = e.id
    WHERE n.exhibitor_id = v_exhibitor
    LIMIT 1;
  END IF;

  IF v_event IS NULL THEN
    RAISE EXCEPTION 'PREFLIGHT FAIL: aucun event_id exploitable pour v_exhibitor';
  END IF;
  RAISE NOTICE 'PREFLIGHT OK: user=% exhibitor=% event=% (visible=%, is_test=%)',
    v_user, v_exhibitor, v_event, v_visible, v_evt_test;

  -- Corps protégé
  BEGIN
    INSERT INTO novelties (event_id, exhibitor_id, title, type, reason_1,
                           media_urls, images_count, created_by, status, is_test)
    VALUES (v_event, v_exhibitor, 'PHASE1C V3 DRAFT', 'Launch',
            'Test securite phase 1C V3', ARRAY['https://example.org/x.jpg'], 1,
            v_user, 'draft', true)
    RETURNING id INTO v_draft;
    v_temp_ids := array_append(v_temp_ids, v_draft);

    -- TEST 3 : UPDATE -> published par non-admin
    PERFORM set_config('request.jwt.claims', v_jwt, true);
    SET LOCAL ROLE authenticated;
    UPDATE novelties SET status = 'published' WHERE id = v_draft;
    RESET ROLE;
    SELECT status INTO v_status FROM novelties WHERE id = v_draft;
    IF v_status = 'published' THEN
      RAISE EXCEPTION 'FAIL TEST3: non-admin a publie via UPDATE (status=%)', v_status;
    END IF;
    RAISE NOTICE 'PASS TEST3: UPDATE->published neutralise, status reste = %', v_status;

    -- TEST 2 : INSERT direct status=published par non-admin
    PERFORM set_config('request.jwt.claims', v_jwt, true);
    SET LOCAL ROLE authenticated;
    v_caught := NULL; v_status := NULL;
    BEGIN
      INSERT INTO novelties (event_id, exhibitor_id, title, type, reason_1,
                             media_urls, images_count, created_by, status, is_test)
      VALUES (v_event, v_exhibitor, 'PHASE1C V3 INSERT', 'Launch',
              'Tentative insert published', ARRAY['https://example.org/x.jpg'], 1,
              v_user, 'published', true)
      RETURNING status INTO v_status;
      RAISE EXCEPTION 'ROLLBACK_TEST2';
    EXCEPTION
      WHEN insufficient_privilege THEN v_caught := 'RLS_BLOCKED';
      WHEN raise_exception THEN
        IF SQLERRM = 'ROLLBACK_TEST2' THEN v_caught := 'ACCEPTED';
        ELSE RAISE; END IF;
      WHEN others THEN v_caught := 'OTHER_BLOCK: ' || SQLERRM;
    END;
    RESET ROLE;
    IF v_caught = 'RLS_BLOCKED' OR v_caught LIKE 'OTHER_BLOCK%' THEN
      RAISE NOTICE 'PASS TEST2: INSERT published bloque (%).', v_caught;
    ELSIF v_caught = 'ACCEPTED' AND v_status IN ('draft','pending','under_review') THEN
      RAISE NOTICE 'PASS TEST2: INSERT accepte mais statut force vers % (annule).', v_status;
    ELSE
      RAISE EXCEPTION 'FAIL TEST2: INSERT published accepte et conserve (status=%)', v_status;
    END IF;

    -- TEST 4 : admin/service peut publier (contexte service_role simule, puis annule)
    PERFORM set_config('request.jwt.claims', v_jwt_svc, true);
    v_caught := NULL; v_status := NULL;
    BEGIN
      UPDATE novelties SET status = 'published' WHERE id = v_draft
      RETURNING status INTO v_status;
      IF v_status <> 'published' THEN
        RAISE EXCEPTION 'FAIL TEST4: admin/service n''a pas pu publier (status=%)', v_status;
      END IF;
      RAISE EXCEPTION 'ROLLBACK_TEST4';
    EXCEPTION
      WHEN raise_exception THEN
        IF SQLERRM = 'ROLLBACK_TEST4' THEN v_caught := 'OK';
        ELSE RAISE; END IF;
    END;
    -- reset claims apres TEST4
    PERFORM set_config('request.jwt.claims', '', true);
    SELECT status INTO v_status FROM novelties WHERE id = v_draft;
    RAISE NOTICE 'PASS TEST4: admin/service peut publier (verifie puis annule). draft restaure=%', v_status;

    -- TEST 7a : sans event_id
    v_caught := NULL;
    BEGIN
      INSERT INTO novelties (event_id, exhibitor_id, title, type, status, is_test)
      VALUES (NULL, v_exhibitor, 'PHASE1C V3 NOEVENT', 'Launch', 'draft', true);
      RAISE EXCEPTION 'ROLLBACK_T7A';
    EXCEPTION
      WHEN not_null_violation THEN v_caught := 'BLOCKED';
      WHEN raise_exception THEN
        IF SQLERRM = 'ROLLBACK_T7A' THEN v_caught := 'ACCEPTED';
        ELSE RAISE; END IF;
      WHEN others THEN v_caught := 'BLOCKED_OTHER: ' || SQLERRM;
    END;
    IF v_caught LIKE 'BLOCKED%' THEN
      RAISE NOTICE 'PASS TEST7a: Nouveaute sans event_id refusee (%).', v_caught;
    ELSE
      RAISE EXCEPTION 'FAIL TEST7a: Nouveaute sans event_id acceptee';
    END IF;

    -- TEST 7b : sans exhibitor_id
    v_caught := NULL;
    BEGIN
      INSERT INTO novelties (event_id, exhibitor_id, title, type, status, is_test)
      VALUES (v_event, NULL, 'PHASE1C V3 NOEXHIB', 'Launch', 'draft', true);
      RAISE EXCEPTION 'ROLLBACK_T7B';
    EXCEPTION
      WHEN not_null_violation THEN v_caught := 'BLOCKED';
      WHEN raise_exception THEN
        IF SQLERRM = 'ROLLBACK_T7B' THEN v_caught := 'ACCEPTED';
        ELSE RAISE; END IF;
      WHEN others THEN v_caught := 'BLOCKED_OTHER: ' || SQLERRM;
    END;
    IF v_caught LIKE 'BLOCKED%' THEN
      RAISE NOTICE 'PASS TEST7b: Nouveaute sans exhibitor_id refusee (%).', v_caught;
    ELSE
      RAISE EXCEPTION 'FAIL TEST7b: Nouveaute sans exhibitor_id acceptee';
    END IF;

    -- CLEANUP succès
    RESET ROLE;
    DELETE FROM novelties WHERE id = ANY(v_temp_ids);
    RAISE NOTICE 'CLEANUP OK: % ligne(s) temporaire(s) supprimee(s).', array_length(v_temp_ids,1);
    RAISE NOTICE 'RESULT: WORKFLOW NOUVEAUTES SECURISE — tous les tests PASS.';

  EXCEPTION
    WHEN OTHERS THEN
      RESET ROLE;
      DELETE FROM novelties WHERE id = ANY(v_temp_ids);
      RAISE NOTICE 'CLEANUP (echec): % ligne(s) supprimee(s).', COALESCE(array_length(v_temp_ids,1),0);
      RAISE;
  END;
END $$;