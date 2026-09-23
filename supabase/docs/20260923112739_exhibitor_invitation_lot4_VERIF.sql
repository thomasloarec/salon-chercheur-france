-- Verification post-application lot 4 (annulee par RAISE EXCEPTION)

DO $verif$
DECLARE
  v_exh uuid := '88a521d0-7897-4591-b9d6-e533ef94af0a';
  v_evt uuid := 'bcec37a4-debc-4b41-9164-28e6dc77fb9d';
  v_owner uuid := '8706a226-7f7c-4270-9ab5-5f2cd03ee51e';
  v_p jsonb; v_inv public.exhibitor_invitation_pages; v_staff uuid; r text := '';
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_owner, 'role','authenticated')::text, true);
  v_p := public.get_invitation_preview(v_exh, v_evt);
  r := r || 'preview_avant: active=' || (v_p->>'active') || ' slug=' || COALESCE(v_p->>'slug','null') || ' ex_id=' || COALESCE(v_p#>>'{exhibitor,id}','null')
         || ' ex_name=' || COALESCE(v_p#>>'{exhibitor,name}','null') || ' nov=' || COALESCE(v_p#>>'{novelty,title}','null')
         || ' nov_img=' || ((v_p#>>'{novelty,url_image}') IS NOT NULL) || ' has_image_url_key=' || (v_p->'novelty' ? 'image_url') || ' stand=' || COALESCE(v_p->>'stand','null') || ' staff=' || jsonb_array_length(v_p->'staff');
  INSERT INTO exhibitor_staff (exhibitor_id, first_name, last_name) VALUES (v_exh, 'Test', 'Lot4') RETURNING id INTO v_staff;
  v_inv := public.upsert_invitation_page(v_exh, v_evt, 'Titre', 'Msg', ARRAY[v_staff], false);
  v_p := public.get_invitation_preview(v_exh, v_evt);
  r := r || ' | preview_brouillon: slug=' || COALESCE(v_p->>'slug','null') || ' headline=' || COALESCE(v_p->>'headline','null') || ' staff=' || jsonb_array_length(v_p->'staff');
  r := r || ' | public_brouillon=' || (public.get_invitation_page(v_inv.slug)->>'reason');
  v_inv := public.upsert_invitation_page(v_exh, v_evt, 'Titre', 'Msg', ARRAY[v_staff], true);
  PERFORM set_config('request.jwt.claims', '', true);
  v_p := public.get_invitation_page(v_inv.slug);
  r := r || ' | public_publie: active=' || (v_p->>'active') || ' ex_id=' || COALESCE(v_p#>>'{exhibitor,id}','null') || ' event_url_image_key=' || (v_p->'event' ? 'url_image') || ' staff=' || jsonb_array_length(v_p->'staff');
  BEGIN PERFORM public.get_invitation_preview(v_exh, v_evt); r := r || ' | preview_anonyme=ACCEPTE(KO)';
  EXCEPTION WHEN others THEN r := r || ' | preview_anonyme=' || SQLERRM; END;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid(), 'role','authenticated')::text, true);
  BEGIN PERFORM public.get_invitation_preview(v_exh, v_evt); r := r || ' | preview_non_membre=ACCEPTE(KO)';
  EXCEPTION WHEN others THEN r := r || ' | preview_non_membre=' || SQLERRM; END;
  r := r || ' | droits build: anon=' || has_function_privilege('anon','public.build_invitation_payload(uuid,uuid,uuid,uuid)','EXECUTE')
         || ' auth=' || has_function_privilege('authenticated','public.build_invitation_payload(uuid,uuid,uuid,uuid)','EXECUTE')
         || ' | preview: anon=' || has_function_privilege('anon','public.get_invitation_preview(uuid,uuid)','EXECUTE')
         || ' auth=' || has_function_privilege('authenticated','public.get_invitation_preview(uuid,uuid)','EXECUTE')
         || ' | page: anon=' || has_function_privilege('anon','public.get_invitation_page(text)','EXECUTE');
  RAISE EXCEPTION 'VERIF_OK | %', r;
END
$verif$;
