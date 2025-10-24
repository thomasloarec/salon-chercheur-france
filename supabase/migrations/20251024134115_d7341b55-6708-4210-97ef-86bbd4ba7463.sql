-- Fix get_user_emails_for_moderation to cast email to text
CREATE OR REPLACE FUNCTION public.get_user_emails_for_moderation(user_ids uuid[])
 RETURNS TABLE(user_id uuid, email text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Only admins can call this function
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Access denied: admin only';
  END IF;

  RETURN QUERY
  SELECT 
    au.id as user_id,
    au.email::text as email
  FROM auth.users au
  WHERE au.id = ANY(user_ids);
END;
$function$;