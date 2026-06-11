CREATE OR REPLACE FUNCTION public.get_exhibitor_completion(ids uuid[])
RETURNS SETOF public.exhibitor_completion
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ec.*
  FROM public.exhibitor_completion ec
  WHERE ec.exhibitor_id = ANY(ids)
    AND (
      public.is_admin()
      OR public.is_team_member(ec.exhibitor_id)
    );
$$;

REVOKE ALL ON FUNCTION public.get_exhibitor_completion(uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_exhibitor_completion(uuid[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_exhibitor_completion(uuid[]) TO authenticated;