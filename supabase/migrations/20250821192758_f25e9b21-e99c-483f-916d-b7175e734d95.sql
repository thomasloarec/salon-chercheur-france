-- Final security fix: Remove SECURITY DEFINER from functions that don't need it
-- and add documentation comments to justify the ones that do need it

-- 1. Fix search_events function - doesn't need SECURITY DEFINER as it only reads public data
CREATE OR REPLACE FUNCTION public.search_events(sector_ids uuid[] DEFAULT '{}'::uuid[], event_types text[] DEFAULT '{}'::text[], months integer[] DEFAULT '{}'::integer[], region_codes text[] DEFAULT '{}'::text[], page_num integer DEFAULT 1, page_size integer DEFAULT 20)
RETURNS TABLE(id uuid, id_event text, nom_event text, date_debut date, date_fin date, ville text, secteur jsonb, url_image text, slug text, rue text, code_postal text, nom_lieu text, url_site_officiel text, type_event text, is_b2b boolean, visible boolean, total_count bigint)
LANGUAGE plpgsql
SECURITY INVOKER  -- Changed from DEFINER to INVOKER
SET search_path TO 'public'
AS $function$
DECLARE
  wheres    text[] := ARRAY[
                'e.visible = true',
                'e.date_debut >= CURRENT_DATE'
              ];
  where_sql text;
  cnt       bigint;
BEGIN
  IF array_length(sector_ids,1) > 0 THEN
    wheres := wheres || ARRAY['e.id_event IN (SELECT event_id FROM event_sectors WHERE sector_id = ANY($1))'];
  END IF;

  IF array_length(event_types,1) > 0 THEN
    wheres := wheres || ARRAY['e.type_event = ANY($2)'];
  END IF;

  IF array_length(months,1) > 0 THEN
    wheres := wheres || ARRAY['EXTRACT(MONTH FROM e.date_debut)::int = ANY($3)'];
  END IF;

  IF array_length(region_codes,1) > 0 THEN
    wheres := wheres || ARRAY['EXISTS (
                           SELECT 1 FROM departements d
                           WHERE LEFT(e.code_postal, 2) = d.code
                             AND d.region_code = ANY($4)
                         )'];
  END IF;

  where_sql := array_to_string(wheres,' AND ');

  EXECUTE
    format('SELECT COUNT(DISTINCT e.id_event) FROM events e WHERE %s', where_sql)
    USING sector_ids, event_types, months, region_codes
    INTO cnt;

  RETURN QUERY EXECUTE
    format($q$
      SELECT DISTINCT
        e.id, e.id_event, e.nom_event, e.date_debut, e.date_fin, e.ville, e.secteur,
        e.url_image, e.slug, e.rue, e.code_postal, e.nom_lieu,
        e.url_site_officiel, e.type_event, e.is_b2b, e.visible,
        %L::bigint AS total_count
      FROM events e
      WHERE %s
      ORDER BY e.date_debut ASC
      LIMIT %s OFFSET %s
    $q$, cnt, where_sql, page_size, (page_num-1)*page_size)
    USING sector_ids, event_types, months, region_codes;
END;
$function$;

-- 2. Fix toggle_favorite function - add better authentication check but keep INVOKER
CREATE OR REPLACE FUNCTION public.toggle_favorite(p_event uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER  -- Changed from DEFINER to INVOKER  
SET search_path TO 'public'
AS $function$
BEGIN
  -- Ensure user is authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required to manage favorites';
  END IF;
  
  IF EXISTS(SELECT 1 FROM public.favorites WHERE user_id = auth.uid() AND event_id = p_event) THEN
    DELETE FROM public.favorites WHERE user_id = auth.uid() AND event_id = p_event;
  ELSE
    INSERT INTO public.favorites(user_id, event_id) VALUES (auth.uid(), p_event);
  END IF;
END;
$function$;

-- 3. Add security documentation comments to functions that legitimately need SECURITY DEFINER
COMMENT ON FUNCTION public.get_current_user_role() IS 'SECURITY DEFINER required: Prevents infinite recursion in RLS policies by bypassing user permissions to read profiles table';

COMMENT ON FUNCTION public.has_role(uuid, app_role) IS 'SECURITY DEFINER required: Core security function that must bypass RLS to check user roles across tables';

COMMENT ON FUNCTION public.is_admin() IS 'SECURITY DEFINER required: Core security function that must bypass RLS to verify admin status';

COMMENT ON FUNCTION public.handle_new_user() IS 'SECURITY DEFINER required: Trigger function needs elevated privileges to create initial user profile';

COMMENT ON FUNCTION public.create_initial_admin() IS 'SECURITY DEFINER required: Must bypass RLS to assign admin roles during user creation';

COMMENT ON FUNCTION public.delete_user_account() IS 'SECURITY DEFINER required: Must access auth.users table which is not accessible via normal RLS';

COMMENT ON FUNCTION public.export_user_data() IS 'SECURITY DEFINER required: Must access auth.users table to export complete user data';

COMMENT ON FUNCTION public.update_user_password() IS 'SECURITY DEFINER required: Must access auth.users table for password operations';

COMMENT ON FUNCTION public.cleanup_expired_csrf_tokens() IS 'SECURITY DEFINER required: System maintenance function needs elevated privileges to clean expired tokens';

COMMENT ON FUNCTION public.log_application_event(text, text, jsonb, text, text, uuid, text, text) IS 'SECURITY DEFINER required: Logging function must bypass RLS to ensure all events are recorded';

COMMENT ON FUNCTION public.publish_pending_event_atomic(text, jsonb) IS 'SECURITY DEFINER required: Admin function needs elevated privileges to publish events and manage staging tables';