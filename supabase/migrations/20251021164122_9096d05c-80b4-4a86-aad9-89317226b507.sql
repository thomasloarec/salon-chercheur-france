-- Create a function to get user emails for admin moderation
-- This function can only be called by authenticated users and returns emails for profile enrichment
CREATE OR REPLACE FUNCTION get_user_emails_for_moderation(user_ids UUID[])
RETURNS TABLE (
  user_id UUID,
  email TEXT
) 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only admins can call this function
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Access denied: admin only';
  END IF;

  RETURN QUERY
  SELECT 
    au.id as user_id,
    au.email
  FROM auth.users au
  WHERE au.id = ANY(user_ids);
END;
$$;