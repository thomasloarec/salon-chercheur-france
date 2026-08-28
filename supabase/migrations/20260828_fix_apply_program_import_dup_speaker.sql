-- Fix — apply_program_import : tolérer une même personne présente plusieurs fois
-- dans une même session (ex. modérateur ET intervenant, fréquent en congrès).
--
-- Cause : la PK de event_program_session_speakers est (session_id, speaker_id) et
-- n'inclut PAS role. L'ancienne version insérait un lien par occurrence, sans
-- garde-fou -> violation de event_program_session_speakers_pkey dès qu'une session
-- référençait deux fois le même intervenant, faisant échouer tout l'import (atomique).
--
-- Correctif : ON CONFLICT (session_id, speaker_id) DO NOTHING sur l'insertion des
-- liens. La 1re occurrence gagne (donc son rôle et sa position). Les compteurs et
-- positions ne sont incrémentés que si une ligne a réellement été insérée (IF FOUND),
-- pour garder des positions contiguës et un décompte 'links' exact.
--
-- Seule la boucle d'insertion des liens change. Tout le reste est identique à
-- 20260824_lot6b_apply_program_import.sql.

CREATE OR REPLACE FUNCTION public.apply_program_import(p_import_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_event_id uuid;
  v_status text;
  v_result jsonb;
  v_ref_map jsonb := '{}'::jsonb;
  v_sp jsonb;
  v_ses jsonb;
  v_lnk jsonb;
  v_speaker_id uuid;
  v_session_id uuid;
  v_ref text;
  v_spk_pos int;
  v_ses_pos int;
  v_lnk_pos int;
  v_n_speakers int := 0;
  v_n_sessions int := 0;
  v_n_links int := 0;
BEGIN
  SELECT event_id, status, result INTO v_event_id, v_status, v_result
  FROM public.staging_program_imports WHERE id = p_import_id;

  IF v_event_id IS NULL THEN
    RAISE EXCEPTION 'Import introuvable.';
  END IF;
  IF NOT (public.is_admin() OR public.is_event_owner(v_event_id)) THEN
    RAISE EXCEPTION 'Acces refuse.';
  END IF;
  IF v_status <> 'extracted' THEN
    RAISE EXCEPTION 'Cet import ne peut pas etre applique (statut actuel : %).', v_status;
  END IF;
  IF v_result IS NULL THEN
    RAISE EXCEPTION 'Aucun resultat d''extraction a appliquer.';
  END IF;

  v_spk_pos := COALESCE((SELECT max(position) FROM public.event_program_speakers WHERE event_id = v_event_id), -1) + 1;
  v_ses_pos := COALESCE((SELECT max(position) FROM public.event_program_sessions WHERE event_id = v_event_id), -1) + 1;

  -- Intervenants
  FOR v_sp IN SELECT jsonb_array_elements(COALESCE(v_result->'speakers', '[]'::jsonb)) LOOP
    IF COALESCE(trim(v_sp->>'full_name'), '') = '' THEN CONTINUE; END IF;
    INSERT INTO public.event_program_speakers (event_id, full_name, job_title, company, linkedin_url, position)
    VALUES (v_event_id, v_sp->>'full_name', v_sp->>'job_title', v_sp->>'company', v_sp->>'linkedin_url', v_spk_pos)
    RETURNING id INTO v_speaker_id;
    v_ref := COALESCE(v_sp->>'ref', v_sp->>'full_name');
    v_ref_map := v_ref_map || jsonb_build_object(v_ref, v_speaker_id::text);
    v_spk_pos := v_spk_pos + 1;
    v_n_speakers := v_n_speakers + 1;
  END LOOP;

  -- Sessions + rattachements
  FOR v_ses IN SELECT jsonb_array_elements(COALESCE(v_result->'sessions', '[]'::jsonb)) LOOP
    IF COALESCE(trim(v_ses->>'title'), '') = '' THEN CONTINUE; END IF;
    INSERT INTO public.event_program_sessions (
      event_id, title, description, session_type, day_date, start_time, end_time,
      location, track, is_highlight, position, status, source
    ) VALUES (
      v_event_id,
      v_ses->>'title',
      v_ses->>'description',
      COALESCE(v_ses->>'session_type', 'conference'),
      (v_ses->>'day_date')::date,
      (v_ses->>'start_time')::time,
      (v_ses->>'end_time')::time,
      v_ses->>'location',
      v_ses->>'track',
      COALESCE((v_ses->>'is_highlight')::boolean, false),
      v_ses_pos,
      'draft',
      'pdf_import'
    ) RETURNING id INTO v_session_id;
    v_ses_pos := v_ses_pos + 1;
    v_n_sessions := v_n_sessions + 1;

    v_lnk_pos := 0;
    FOR v_lnk IN SELECT jsonb_array_elements(COALESCE(v_ses->'speakers', '[]'::jsonb)) LOOP
      v_ref := v_lnk->>'ref';
      IF v_ref IS NULL OR NOT (v_ref_map ? v_ref) THEN CONTINUE; END IF;
      v_speaker_id := (v_ref_map->>v_ref)::uuid;
      -- CHANGEMENT : garde-fou anti-doublon (même personne 2x dans la même session).
      -- La 1re occurrence l'emporte ; les suivantes sont ignorees sans casser l'import.
      INSERT INTO public.event_program_session_speakers (session_id, speaker_id, role, position)
      VALUES (
        v_session_id, v_speaker_id,
        CASE WHEN v_lnk->>'role' IN ('intervenant','moderateur','interviewe','animateur')
             THEN v_lnk->>'role' ELSE 'intervenant' END,
        v_lnk_pos
      )
      ON CONFLICT (session_id, speaker_id) DO NOTHING;
      -- N'incremente position et compteur que si une ligne a bien ete inseree.
      IF FOUND THEN
        v_lnk_pos := v_lnk_pos + 1;
        v_n_links := v_n_links + 1;
      END IF;
    END LOOP;
  END LOOP;

  UPDATE public.staging_program_imports SET status = 'applied', applied_at = now() WHERE id = p_import_id;

  RETURN jsonb_build_object('ok', true, 'sessions', v_n_sessions, 'speakers', v_n_speakers, 'links', v_n_links);
END;
$function$;

REVOKE ALL ON FUNCTION public.apply_program_import(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.apply_program_import(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.apply_program_import(uuid) TO authenticated;
