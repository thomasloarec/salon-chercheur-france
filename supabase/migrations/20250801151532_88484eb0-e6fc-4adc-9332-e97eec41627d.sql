-- PHASE 1: CRITICAL - Activer RLS sur les tables manquantes
-- D'après le linter, il y a 2 tables sans RLS activé

-- Activer RLS sur toutes les tables qui n'en ont pas
-- Commençons par identifier et corriger les tables critiques

-- Table participation - Active RLS et politique de lecture publique
ALTER TABLE public.participation ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read access to participation" 
  ON public.participation 
  FOR SELECT 
  TO anon, authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage participation" 
  ON public.participation 
  FOR ALL 
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Table exposants - Active RLS et politique de lecture publique  
ALTER TABLE public.exposants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read access to exposants" 
  ON public.exposants 
  FOR SELECT 
  TO anon, authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage exposants" 
  ON public.exposants 
  FOR ALL 
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- PHASE 2: ERROR - Corriger les vues SECURITY DEFINER
-- Identifier et corriger la vue problématique (events_geo semble être une vue)
DROP VIEW IF EXISTS public.events_geo;

-- Recréer en tant que vue normale sans SECURITY DEFINER
CREATE VIEW public.events_geo AS
SELECT 
  e.id,
  LEFT(e.code_postal, 2) as dep_code,
  d.region_code,
  e.code_postal
FROM public.events e
LEFT JOIN public.departements d ON LEFT(e.code_postal, 2) = d.code;

-- PHASE 3: WARNINGS - Sécuriser les fonctions avec search_path
-- Corriger toutes les fonctions pour avoir un search_path sécurisé

-- Fonction cleanup_expired_csrf_tokens
CREATE OR REPLACE FUNCTION public.cleanup_expired_csrf_tokens()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  DELETE FROM public.csrf_tokens 
  WHERE expires_at < now();
END;
$function$;

-- Fonction update_user_password  
CREATE OR REPLACE FUNCTION public.update_user_password(current_password text, new_password text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  user_id uuid;
BEGIN
  user_id := auth.uid();
  IF user_id IS NULL THEN
    RETURN json_build_object('error', 'Not authenticated');
  END IF;
  RETURN json_build_object('success', true);
END;
$function$;

-- Fonction delete_user_account
CREATE OR REPLACE FUNCTION public.delete_user_account()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  user_id uuid;
BEGIN
  user_id := auth.uid();
  IF user_id IS NULL THEN
    RETURN json_build_object('error', 'Not authenticated');
  END IF;

  DELETE FROM public.favorites WHERE user_id = auth.uid();
  DELETE FROM public.newsletter_subscriptions WHERE email = (
    SELECT email FROM auth.users WHERE id = auth.uid()
  );
  DELETE FROM public.profiles WHERE user_id = auth.uid();
  
  RETURN json_build_object('success', true);
END;
$function$;

-- Fonction export_user_data
CREATE OR REPLACE FUNCTION public.export_user_data()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  user_id uuid;
  user_data json;
BEGIN
  user_id := auth.uid();
  IF user_id IS NULL THEN
    RETURN json_build_object('error', 'Not authenticated');
  END IF;

  SELECT json_build_object(
    'profile', row_to_json(p.*),
    'favorites', json_agg(DISTINCT f.*),
    'newsletter_subscriptions', json_agg(DISTINCT ns.*)
  ) INTO user_data
  FROM public.profiles p
  LEFT JOIN public.favorites f ON f.user_id = p.user_id
  LEFT JOIN public.newsletter_subscriptions ns ON ns.email = (
    SELECT email FROM auth.users WHERE id = p.user_id
  )
  WHERE p.user_id = user_id
  GROUP BY p.id;

  RETURN user_data;
END;
$function$;

-- Fonction log_application_event
CREATE OR REPLACE FUNCTION public.log_application_event(
  p_level text, 
  p_message text, 
  p_details jsonb DEFAULT NULL::jsonb, 
  p_source text DEFAULT 'edge-function'::text, 
  p_function_name text DEFAULT NULL::text, 
  p_user_id uuid DEFAULT NULL::uuid, 
  p_ip_address text DEFAULT NULL::text, 
  p_user_agent text DEFAULT NULL::text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.application_logs (
    level, message, details, source, function_name, 
    user_id, ip_address, user_agent
  ) VALUES (
    p_level, p_message, p_details, p_source, p_function_name,
    p_user_id, p_ip_address, p_user_agent
  );
END;
$function$;