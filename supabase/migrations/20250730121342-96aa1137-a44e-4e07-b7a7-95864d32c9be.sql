-- Création de la fonction RPC pour publication atomique d'événements
CREATE OR REPLACE FUNCTION public.publish_pending_event_atomic(
  p_id_event text,
  p_event_data jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  existing_count integer;
  result_event jsonb;
BEGIN
  -- Vérifier si l'événement existe déjà
  SELECT COUNT(*) INTO existing_count 
  FROM events WHERE id_event = p_id_event;
  
  IF existing_count > 0 THEN
    -- UPDATE pour événement existant
    UPDATE events SET
      nom_event = p_event_data->>'nom_event',
      type_event = p_event_data->>'type_event',
      description_event = p_event_data->>'description_event',
      date_debut = (p_event_data->>'date_debut')::date,
      date_fin = (p_event_data->>'date_fin')::date,
      secteur = p_event_data->'secteur',
      url_image = p_event_data->>'url_image',
      url_site_officiel = p_event_data->>'url_site_officiel',
      affluence = p_event_data->>'affluence',
      tarif = p_event_data->>'tarif',
      nom_lieu = p_event_data->>'nom_lieu',
      rue = p_event_data->>'rue',
      code_postal = p_event_data->>'code_postal',
      ville = p_event_data->>'ville',
      pays = COALESCE(p_event_data->>'pays', 'France'),
      location = p_event_data->>'location',
      is_b2b = COALESCE((p_event_data->>'is_b2b')::boolean, false),
      visible = true,
      updated_at = now()
    WHERE id_event = p_id_event
    RETURNING to_jsonb(events.*) INTO result_event;
  ELSE
    -- INSERT nouveau événement (visible=false) puis UPDATE pour publication
    INSERT INTO events (
      id_event, nom_event, type_event, description_event,
      date_debut, date_fin, secteur, url_image, url_site_officiel,
      affluence, tarif, nom_lieu, rue, code_postal, ville, pays,
      location, is_b2b, visible
    ) VALUES (
      p_id_event,
      p_event_data->>'nom_event',
      p_event_data->>'type_event', 
      p_event_data->>'description_event',
      (p_event_data->>'date_debut')::date,
      (p_event_data->>'date_fin')::date,
      p_event_data->'secteur',
      p_event_data->>'url_image',
      p_event_data->>'url_site_officiel',
      p_event_data->>'affluence',
      p_event_data->>'tarif',
      p_event_data->>'nom_lieu',
      p_event_data->>'rue',
      p_event_data->>'code_postal',
      p_event_data->>'ville',
      COALESCE(p_event_data->>'pays', 'France'),
      p_event_data->>'location',
      COALESCE((p_event_data->>'is_b2b')::boolean, false),
      false  -- visible=false pour éviter le trigger
    );
    
    -- Puis UPDATE pour rendre visible (publication)
    UPDATE events SET visible = true, updated_at = now()
    WHERE id_event = p_id_event
    RETURNING to_jsonb(events.*) INTO result_event;
  END IF;
  
  RETURN result_event;
END;
$$;