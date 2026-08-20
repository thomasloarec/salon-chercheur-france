CREATE OR REPLACE FUNCTION public.admin_list_event_claim_identities(p_event_id uuid)
RETURNS TABLE (
  id uuid,
  status text,
  message text,
  created_at timestamptz,
  requester_user_id uuid,
  first_name text,
  last_name text,
  email text,
  phone text,
  job_title text,
  company text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Accès réservé aux administrateurs';
  END IF;

  RETURN QUERY
  SELECT
    r.id,
    r.status,
    r.message,
    r.created_at,
    r.requester_user_id,
    p.first_name,
    p.last_name,
    u.email::text,
    p.phone,
    p.job_title,
    p.company
  FROM public.event_claim_requests r
  LEFT JOIN public.profiles p ON p.user_id = r.requester_user_id
  LEFT JOIN auth.users u ON u.id = r.requester_user_id
  WHERE r.event_id = p_event_id
  ORDER BY r.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_event_claim_identities(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_event_claim_identities(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_event_claim_identities(uuid) TO service_role;