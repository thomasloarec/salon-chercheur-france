CREATE OR REPLACE FUNCTION public.delete_user_account()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN json_build_object('error', 'Not authenticated');
  END IF;

  DELETE FROM public.favorites f WHERE f.user_id = v_user_id;
  DELETE FROM public.newsletter_subscriptions WHERE email = (
    SELECT email FROM auth.users WHERE id = v_user_id
  );
  DELETE FROM public.profiles p WHERE p.user_id = v_user_id;
  
  RETURN json_build_object('success', true);
END;
$function$;