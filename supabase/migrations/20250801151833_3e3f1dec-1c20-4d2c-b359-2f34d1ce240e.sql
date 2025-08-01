-- Continuer la sécurisation des fonctions restantes avec search_path

-- Fonction publish_pending_event_atomic
CREATE OR REPLACE FUNCTION public.publish_pending_event_atomic(p_id_event text, p_event_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  existing_count integer;
  result_event jsonb;
BEGIN
  RAISE LOG 'publish_pending_event_atomic: Début pour id_event=%', p_id_event;
  
  SELECT COUNT(*) INTO existing_count 
  FROM events WHERE id_event = p_id_event;
  
  IF existing_count > 0 THEN
    RAISE LOG 'publish_pending_event_atomic: UPDATE événement existant %', p_id_event;
    
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
    RAISE LOG 'publish_pending_event_atomic: INSERT nouveau événement %', p_id_event;
    
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
      false
    );
    
    RAISE LOG 'publish_pending_event_atomic: Publication (visible=true) pour %', p_id_event;
    
    UPDATE events SET visible = true, updated_at = now()
    WHERE id_event = p_id_event
    RETURNING to_jsonb(events.*) INTO result_event;
  END IF;
  
  RAISE LOG 'publish_pending_event_atomic: Succès pour %', p_id_event;
  RETURN result_event;
  
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'publish_pending_event_atomic: Erreur pour % - %', p_id_event, SQLERRM;
  RETURN jsonb_build_object(
    'error', true,
    'message', SQLERRM,
    'id_event', p_id_event
  );
END;
$function$;

-- Fonction get_user_crm_matches
CREATE OR REPLACE FUNCTION public.get_user_crm_matches(p_user_id uuid)
RETURNS TABLE(company_id uuid, company_name text, company_website text, provider text, events_count integer, upcoming_events jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    c.id as company_id,
    c.name as company_name,
    c.website as company_website,
    ucc.provider,
    COUNT(e.id)::int as events_count,
    COALESCE(
      JSONB_AGG(
        JSONB_BUILD_OBJECT(
          'id', e.id,
          'nom_event', e.nom_event,
          'date_debut', e.date_debut,
          'ville', e.ville
        ) ORDER BY e.date_debut ASC
      ) FILTER (WHERE e.id IS NOT NULL),
      '[]'::jsonb
    ) as upcoming_events
  FROM user_crm_companies ucc
  JOIN companies c ON c.id = ucc.company_id
  LEFT JOIN participation p ON LOWER(TRIM(p.website_exposant)) = LOWER(TRIM(c.website))
  LEFT JOIN events e ON e.id_event = p.id_event 
    AND e.visible = true 
    AND e.date_debut >= CURRENT_DATE
  WHERE ucc.user_id = p_user_id
  GROUP BY c.id, c.name, c.website, ucc.provider
  ORDER BY c.name;
END;
$function$;

-- Fonction has_role
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  ) OR EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE user_id = _user_id
      AND role = _role
  );
$function$;

-- Fonction get_current_user_role
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS app_role
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    (SELECT role FROM public.profiles WHERE user_id = auth.uid()),
    'user'::app_role
  );
$function$;

-- Fonction is_admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT public.has_role(auth.uid(), 'admin'::app_role);
$function$;

-- Fonction toggle_favorite
CREATE OR REPLACE FUNCTION public.toggle_favorite(p_event uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF EXISTS(SELECT 1 FROM public.favorites WHERE user_id = auth.uid() AND event_id = p_event) THEN
    DELETE FROM public.favorites WHERE user_id = auth.uid() AND event_id = p_event;
  ELSE
    INSERT INTO public.favorites(user_id, event_id) VALUES (auth.uid(), p_event);
  END IF;
END;
$function$;

-- Fonction handle_new_user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, first_name, last_name, role)
  VALUES (
    new.id,
    new.raw_user_meta_data ->> 'first_name',
    new.raw_user_meta_data ->> 'last_name',
    'user'::app_role
  );
  RETURN new;
END;
$function$;

-- Fonction create_initial_admin
CREATE OR REPLACE FUNCTION public.create_initial_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.email = 'admin@salonspro.com' THEN
    UPDATE public.profiles 
    SET role = 'admin'::app_role 
    WHERE user_id = NEW.id;
    
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin'::app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$function$;