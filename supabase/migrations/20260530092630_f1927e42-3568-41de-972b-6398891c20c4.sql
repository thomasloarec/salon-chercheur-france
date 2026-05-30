DROP TABLE IF EXISTS public._rls_test_results;
CREATE TABLE public._rls_test_results (
  test_no int,
  label text,
  field text,
  before_val text,
  after_val text,
  expected text,
  passed boolean
);
GRANT SELECT ON public._rls_test_results TO service_role;

DO $$
DECLARE
  v_ex uuid := '1cf6f485-26bd-4977-93c7-f981eae864f8';
  v_owner uuid := '190cc989-77bc-4b66-ba88-4eb7802a7c2d';
  v_admin uuid := '7424675e-535a-433c-8baa-a4f55c92a91e';
  b_approved boolean; b_plan text; b_owner uuid; b_desc text; b_logo text;
  a_val text;
BEGIN
  -- Snapshot initial
  SELECT approved, plan, owner_user_id, description, logo_url
    INTO b_approved, b_plan, b_owner, b_desc, b_logo
    FROM exhibitors WHERE id = v_ex;

  ---------------------------------------------------------------------------
  -- TEST 1 : owner tente approved = true  -> doit rester inchangé
  ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_owner::text, 'role','authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  UPDATE exhibitors SET approved = true WHERE id = v_ex;
  RESET ROLE;
  SELECT approved::text INTO a_val FROM exhibitors WHERE id = v_ex;
  INSERT INTO public._rls_test_results VALUES
    (1,'owner -> approved=true','approved', b_approved::text, a_val, 'unchanged', a_val IS NOT DISTINCT FROM b_approved::text);

  ---------------------------------------------------------------------------
  -- TEST 2 : owner tente plan = 'paid' -> doit rester inchangé
  ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_owner::text, 'role','authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  UPDATE exhibitors SET plan = 'paid' WHERE id = v_ex;
  RESET ROLE;
  SELECT plan INTO a_val FROM exhibitors WHERE id = v_ex;
  INSERT INTO public._rls_test_results VALUES
    (2,'owner -> plan=paid','plan', b_plan, a_val, 'unchanged', a_val IS NOT DISTINCT FROM b_plan);

  ---------------------------------------------------------------------------
  -- TEST 3 : owner tente owner_user_id = autre uuid -> doit rester inchangé
  ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_owner::text, 'role','authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  UPDATE exhibitors SET owner_user_id = v_admin WHERE id = v_ex;
  RESET ROLE;
  SELECT owner_user_id::text INTO a_val FROM exhibitors WHERE id = v_ex;
  INSERT INTO public._rls_test_results VALUES
    (3,'owner -> owner_user_id=other','owner_user_id', b_owner::text, a_val, 'unchanged', a_val IS NOT DISTINCT FROM b_owner::text);

  ---------------------------------------------------------------------------
  -- TEST 4 : owner modifie description + logo_url -> doit reussir
  ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_owner::text, 'role','authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  UPDATE exhibitors SET description = '__test_desc__', logo_url = '__test_logo__' WHERE id = v_ex;
  RESET ROLE;
  SELECT description || '|' || logo_url INTO a_val FROM exhibitors WHERE id = v_ex;
  INSERT INTO public._rls_test_results VALUES
    (4,'owner -> description+logo_url','description|logo_url', coalesce(b_desc,'')||'|'||coalesce(b_logo,''), a_val, 'changed', a_val = '__test_desc__|__test_logo__');

  ---------------------------------------------------------------------------
  -- TEST 5 : admin modifie approved = true -> doit reussir
  ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin::text, 'role','authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  UPDATE exhibitors SET approved = NOT b_approved WHERE id = v_ex;
  RESET ROLE;
  SELECT approved::text INTO a_val FROM exhibitors WHERE id = v_ex;
  INSERT INTO public._rls_test_results VALUES
    (5,'admin -> approved flip','approved', b_approved::text, a_val, 'changed', a_val = (NOT b_approved)::text);

  ---------------------------------------------------------------------------
  -- TEST 6 : service_role (claim approval) modifie approved -> doit reussir
  ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', json_build_object('role','service_role')::text, true);
  SET LOCAL ROLE service_role;
  UPDATE exhibitors SET approved = true WHERE id = v_ex;
  RESET ROLE;
  SELECT approved::text INTO a_val FROM exhibitors WHERE id = v_ex;
  INSERT INTO public._rls_test_results VALUES
    (6,'service_role -> approved=true','approved','(n/a)', a_val, 'changed', a_val = 'true');

  ---------------------------------------------------------------------------
  -- RESTAURATION des valeurs initiales (role privilegie de migration)
  ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', json_build_object('role','service_role')::text, true);
  UPDATE exhibitors
     SET approved = b_approved,
         plan = b_plan,
         owner_user_id = b_owner,
         description = b_desc,
         logo_url = b_logo
   WHERE id = v_ex;
END $$;