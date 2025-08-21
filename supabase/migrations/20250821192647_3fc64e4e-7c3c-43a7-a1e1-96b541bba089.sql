-- Fix Security Definer Functions - Remove SECURITY DEFINER where not needed
-- and ensure proper security checks where it is needed

-- 1. Fix generate_event_slug - doesn't need SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.generate_event_slug(event_name text, event_city text, event_year integer)
RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER  -- Changed from DEFINER to INVOKER
SET search_path TO 'public'
AS $function$
DECLARE
    clean_name text;
    clean_city text;
    slug text;
    counter integer := 0;
    final_slug text;
BEGIN
    clean_name := lower(event_name);
    clean_name := unaccent(clean_name);
    clean_name := regexp_replace(clean_name, '''', '', 'g');
    clean_name := regexp_replace(clean_name, '[^a-z0-9 -]', '', 'g');
    clean_name := regexp_replace(clean_name, ' +', '-', 'g');
    clean_name := regexp_replace(clean_name, '-+', '-', 'g');
    clean_name := trim(both '-' from clean_name);
    
    clean_city := lower(event_city);
    clean_city := unaccent(clean_city);
    clean_city := regexp_replace(clean_city, '''', '', 'g');
    clean_city := regexp_replace(clean_city, '[^a-z0-9]', '', 'g');
    
    slug := clean_name || '-' || event_year || '-' || clean_city;
    final_slug := slug;
    
    WHILE EXISTS (SELECT 1 FROM public.events WHERE slug = final_slug) LOOP
        counter := counter + 1;
        final_slug := slug || '-' || counter;
    END LOOP;
    
    RETURN final_slug;
END;
$function$;

-- 2. Fix get_user_crm_matches - add proper authentication check and use INVOKER
CREATE OR REPLACE FUNCTION public.get_user_crm_matches(p_user_id uuid)
RETURNS TABLE(company_id uuid, company_name text, company_website text, provider text, events_count integer, upcoming_events jsonb)
LANGUAGE plpgsql
SECURITY INVOKER  -- Changed from DEFINER to INVOKER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Security check: only allow users to query their own data or admins to query anyone's
  IF p_user_id != auth.uid() AND NOT is_admin() THEN
    RAISE EXCEPTION 'Access denied: can only query own CRM matches';
  END IF;

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