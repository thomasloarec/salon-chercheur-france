CREATE OR REPLACE FUNCTION public.check_ai_credits(p_user_id uuid, p_is_anonymous boolean)
 RETURNS TABLE(used integer, allowed integer, remaining integer, wall_type text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH cfg AS (
    SELECT CASE
             WHEN has_role(p_user_id, 'admin'::app_role) THEN 999999
             WHEN p_is_anonymous THEN 5
             ELSE 10
           END AS allw
  ),
  u AS (SELECT count(*)::integer AS used FROM public.ai_search_usage WHERE user_id = p_user_id)
  SELECT
    u.used,
    cfg.allw,
    GREATEST(cfg.allw - u.used, 0),
    CASE WHEN u.used < cfg.allw THEN NULL
         WHEN p_is_anonymous THEN 'signup'
         ELSE 'paywall' END
  FROM u, cfg;
$function$;