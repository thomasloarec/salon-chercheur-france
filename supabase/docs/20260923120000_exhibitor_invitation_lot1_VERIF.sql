-- Verification post-application du lot 1 (a executer APRES apply_migration).
-- Tout est annule : le RAISE EXCEPTION final force le ROLLBACK et affiche le resultat.
-- Attendu (23/09/2026, dry-run en production) :
--   overview_avant=[Sommet de l'elevage:ready] | status=published | status2=draft | page_brouillon=not_found
--   overview_apres=[...:online] | sans_nouveaute=no_published_novelty | staff_etranger=invalid_staff
--   photo_ok=true photo_autre=false photo_bizarre=false | non_membre_upsert=forbidden | non_membre_leads=forbidden
--   page_active=true stand=E7-43 staff=1 raisons=2 img=true | page_inconnue=not_found
--   anon: page=true upsert=false overview=false leads=false photo=false
DO $verif$
DECLARE
  v_exh uuid := '88a521d0-7897-4591-b9d6-e533ef94af0a';
  v_evt uuid := 'bcec37a4-debc-4b41-9164-28e6dc77fb9d';
  v_owner uuid := '8706a226-7f7c-4270-9ab5-5f2cd03ee51e';
  v_other_evt uuid;
  v_staff uuid;
  v_inv public.exhibitor_invitation_pages;
  v_page jsonb;
  v_ov text;
  r text := '';
  v_err text;
BEGIN
  SELECT e.id INTO v_other_evt FROM events e
   WHERE e.visible AND COALESCE(e.is_test,false)=false AND e.date_debut > current_date AND e.id <> v_evt
     AND NOT EXISTS (SELECT 1 FROM novelties n WHERE n.event_id=e.id AND n.exhibitor_id=v_exh)
   LIMIT 1;

  -- en tant que manager
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_owner, 'role','authenticated')::text, true);
  r := r || 'uid=' || COALESCE(auth.uid()::text,'NULL') || ' team=' || public.is_team_member(v_exh);

  SELECT string_agg(o.event_name||':'||o.state, ', ') INTO v_ov FROM public.get_invitation_pages_overview(v_exh) o;
  r := r || ' | overview_avant=[' || COALESCE(v_ov,'vide') || ']';

  INSERT INTO exhibitor_staff (exhibitor_id, first_name, last_name, job_title, linkedin_url)
  VALUES (v_exh, 'Test', 'Personne', 'Commercial', 'https://www.linkedin.com/in/test') RETURNING id INTO v_staff;

  v_inv := public.upsert_invitation_page(v_exh, v_evt, 'Retrouvez-nous', 'Message test', ARRAY[v_staff], true);
  r := r || ' | slug=' || v_inv.slug || ' status=' || v_inv.status;

  -- slug stable a la 2e sauvegarde + depublication
  v_inv := public.upsert_invitation_page(v_exh, v_evt, 'Titre 2', NULL, ARRAY[v_staff], false);
  r := r || ' | slug2=' || v_inv.slug || ' status2=' || v_inv.status;
  v_page := public.get_invitation_page(v_inv.slug);
  r := r || ' | page_brouillon=' || (v_page->>'reason');
  v_inv := public.upsert_invitation_page(v_exh, v_evt, 'Titre 2', NULL, ARRAY[v_staff], true);

  SELECT string_agg(o.event_name||':'||o.state, ', ') INTO v_ov FROM public.get_invitation_pages_overview(v_exh) o;
  r := r || ' | overview_apres=[' || COALESCE(v_ov,'vide') || ']';

  BEGIN
    PERFORM public.upsert_invitation_page(v_exh, v_other_evt, NULL, NULL, NULL, true);
    r := r || ' | sans_nouveaute=ACCEPTE(KO)';
  EXCEPTION WHEN others THEN r := r || ' | sans_nouveaute=' || SQLERRM; END;

  BEGIN
    PERFORM public.upsert_invitation_page(v_exh, v_evt, NULL, NULL, ARRAY[gen_random_uuid()], true);
    r := r || ' | staff_etranger=ACCEPTE(KO)';
  EXCEPTION WHEN others THEN r := r || ' | staff_etranger=' || SQLERRM; END;

  r := r || ' | leads=' || (SELECT count(*) FROM public.get_exhibitor_leads(v_exh));
  r := r || ' | photo_ok=' || public.can_manage_staff_object(v_exh||'/a.jpg')
         || ' photo_autre=' || public.can_manage_staff_object(gen_random_uuid()||'/a.jpg')
         || ' photo_bizarre=' || public.can_manage_staff_object('../a.jpg');

  -- en tant qu'utilisateur non membre
  PERFORM set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid(), 'role','authenticated')::text, true);
  BEGIN
    PERFORM public.upsert_invitation_page(v_exh, v_evt, NULL, NULL, NULL, true);
    r := r || ' | non_membre_upsert=ACCEPTE(KO)';
  EXCEPTION WHEN others THEN r := r || ' | non_membre_upsert=' || SQLERRM; END;
  BEGIN
    PERFORM public.get_exhibitor_leads(v_exh);
    r := r || ' | non_membre_leads=ACCEPTE(KO)';
  EXCEPTION WHEN others THEN r := r || ' | non_membre_leads=' || SQLERRM; END;

  -- page publique (sans session)
  PERFORM set_config('request.jwt.claims', '', true);
  v_page := public.get_invitation_page(v_inv.slug);
  r := r || ' | page_active=' || (v_page->>'active') || ' stand=' || COALESCE(v_page->>'stand','null')
         || ' staff=' || jsonb_array_length(v_page->'staff') || ' raisons=' || jsonb_array_length(v_page#>'{novelty,reasons}')
         || ' img=' || (v_page#>>'{novelty,image_url}' IS NOT NULL);
  r := r || ' | page_inconnue=' || (public.get_invitation_page('xxx-inconnu')->>'reason');

  -- droits anon
  r := r || ' | anon: page=' || has_function_privilege('anon','public.get_invitation_page(text)','EXECUTE')
         || ' upsert=' || has_function_privilege('anon','public.upsert_invitation_page(uuid,uuid,text,text,uuid[],boolean)','EXECUTE')
         || ' overview=' || has_function_privilege('anon','public.get_invitation_pages_overview(uuid)','EXECUTE')
         || ' leads=' || has_function_privilege('anon','public.get_exhibitor_leads(uuid)','EXECUTE')
         || ' photo=' || has_function_privilege('anon','public.can_manage_staff_object(text)','EXECUTE');
  r := r || ' | anon_select_staff=' || has_table_privilege('anon','public.exhibitor_staff','SELECT')
         || ' rls=' || (SELECT relrowsecurity FROM pg_class WHERE oid='public.exhibitor_staff'::regclass);

  -- Floutage D1 : 5 leads Nouveaute (2 attendus floutes) + 1 lead page d'invitation (jamais floute)
  INSERT INTO leads (novelty_id, exhibitor_id, event_id, lead_type, first_name, last_name, email)
  SELECT n.id, v_exh, v_evt, 'resource_download', 'Prenom'||g, 'Nom'||g, 'test'||g||'@exemple.fr'
  FROM novelties n, generate_series(1,5) g
  WHERE n.exhibitor_id = v_exh AND n.event_id = v_evt AND n.status = 'published' LIMIT 5;
  INSERT INTO leads (exhibitor_id, event_id, lead_type, first_name, last_name, email, source, preferred_slot)
  VALUES (v_exh, v_evt, 'meeting_request', 'Invite', 'Reseau', 'invite@exemple.fr', 'invitation_page', 'Mar. 7 oct. · Matin');
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_owner, 'role','authenticated')::text, true);
  r := r || ' | floutage: nouveaute_floutes=' || (SELECT count(*) FROM public.get_exhibitor_leads(v_exh) x WHERE x.origin='novelty' AND x.masked)
         || ' invitation_floutes=' || (SELECT count(*) FROM public.get_exhibitor_leads(v_exh) x WHERE x.origin='invitation_page' AND x.masked)
         || ' creneau=' || (SELECT x.preferred_slot FROM public.get_exhibitor_leads(v_exh) x WHERE x.origin='invitation_page')
         || ' compteur_invitation=' || (SELECT o.requests_count FROM public.get_invitation_pages_overview(v_exh) o WHERE o.event_id = v_evt);
  -- attendu : nouveaute_floutes=2 invitation_floutes=0 creneau=Mar. 7 oct. · Matin compteur_invitation=1 (sauf Premium actif)
  RAISE EXCEPTION 'VERIF_OK | %', r;
END
$verif$;

