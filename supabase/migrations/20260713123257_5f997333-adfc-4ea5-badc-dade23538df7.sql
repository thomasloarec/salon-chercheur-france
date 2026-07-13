CREATE OR REPLACE FUNCTION public.insert_ai_search_event(
  p_conversation_key uuid,
  p_question_rank smallint,
  p_persona text,
  p_query_sanitized text,
  p_sanitization_status text,
  p_intent_type text,
  p_macro_sector_name text,
  p_sub_sector_names text[],
  p_event_slugs text[],
  p_matched_exhibitor_count integer,
  p_answer_had_results boolean
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_macro_id uuid; v_sub_ids uuid[]; v_event_ids uuid[]; v_embedding vector(1024);
  v_persona text := COALESCE(NULLIF(p_persona,''), 'inconnu');
  v_status  text := COALESCE(NULLIF(p_sanitization_status,''), 'ok');
  v_intent  text := p_intent_type;
BEGIN
  -- valeurs contrôlées (fail-safe : ne jamais perdre l'événement sur une valeur hors enum)
  IF v_persona NOT IN ('visiteur','exposant','organisateur','inconnu') THEN v_persona := 'inconnu'; END IF;
  IF v_status  NOT IN ('ok','fallback_metadata_only') THEN v_status := 'fallback_metadata_only'; END IF;
  IF v_intent IS NOT NULL AND v_intent NOT IN
     ('decouverte_salon','recherche_exposant','preparation_visite','comparaison','hors_sujet','autre')
     THEN v_intent := 'autre'; END IF;

  IF p_macro_sector_name IS NOT NULL THEN
    SELECT id INTO v_macro_id FROM sectors WHERE name = p_macro_sector_name;
  END IF;

  IF p_sub_sector_names IS NOT NULL AND array_length(p_sub_sector_names,1) >= 1 THEN
    SELECT array_agg(id) INTO v_sub_ids FROM sub_sectors WHERE name = ANY(p_sub_sector_names);
  END IF;

  IF p_event_slugs IS NOT NULL AND array_length(p_event_slugs,1) >= 1 THEN
    SELECT array_agg(id) INTO v_event_ids FROM events WHERE slug = ANY(p_event_slugs);
  END IF;

  IF v_status = 'ok' AND p_query_sanitized IS NOT NULL AND length(trim(p_query_sanitized)) > 0 THEN
    BEGIN
      v_embedding := cohere_embed_query(p_query_sanitized);
    EXCEPTION WHEN OTHERS THEN
      v_embedding := NULL;  -- si l'embedding échoue (cold start Cohere), on garde la ligne sans vecteur
    END;
  END IF;

  INSERT INTO ai_search_events (
    occurred_hour, conversation_key, question_rank, persona,
    query_sanitized, sanitization_status, intent_type,
    macro_sector_id, sub_sector_ids, matched_event_ids,
    matched_exhibitor_count, answer_had_results, query_embedding
  ) VALUES (
    date_trunc('hour', now()), p_conversation_key, p_question_rank, v_persona,
    CASE WHEN v_status = 'ok' THEN p_query_sanitized ELSE NULL END,   -- jamais de verbatim si non validé
    v_status, v_intent,
    v_macro_id, COALESCE(v_sub_ids, '{}'), COALESCE(v_event_ids, '{}'),
    COALESCE(p_matched_exhibitor_count, 0), p_answer_had_results, v_embedding
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.insert_ai_search_event(uuid,smallint,text,text,text,text,text,text[],text[],integer,boolean) TO service_role;