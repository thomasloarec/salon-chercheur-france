-- Fix functions missing SET search_path TO 'public'
-- This prevents search_path injection attacks

-- Fix get_novelty_likes_count
CREATE OR REPLACE FUNCTION public.get_novelty_likes_count(novelty_uuid uuid)
 RETURNS integer
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  SELECT COUNT(*)::INTEGER
  FROM novelty_likes
  WHERE novelty_id = novelty_uuid;
$function$;

-- Fix count_active_leads
CREATE OR REPLACE FUNCTION public.count_active_leads(exhibitor_uuid uuid)
 RETURNS integer
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  SELECT COUNT(*)::INTEGER
  FROM leads
  WHERE exhibitor_id = exhibitor_uuid
    AND created_at > NOW() - INTERVAL '30 days';
$function$;

-- Fix update_notifications_updated_at
CREATE OR REPLACE FUNCTION public.update_notifications_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

-- Fix update_leads_updated_at
CREATE OR REPLACE FUNCTION public.update_leads_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

-- Fix get_exhibitor_uuid
CREATE OR REPLACE FUNCTION public.get_exhibitor_uuid(old_id text)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  found_uuid uuid;
BEGIN
  -- Essayer de trouver par correspondance de nom dans exhibitors
  SELECT e.id INTO found_uuid
  FROM exhibitors e
  JOIN exposants ex ON LOWER(TRIM(e.name)) = LOWER(TRIM(ex.nom_exposant))
  WHERE ex.id_exposant = old_id
  LIMIT 1;
  
  RETURN found_uuid;
END;
$function$;

-- Fix update_novelty_comments_updated_at
CREATE OR REPLACE FUNCTION public.update_novelty_comments_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;