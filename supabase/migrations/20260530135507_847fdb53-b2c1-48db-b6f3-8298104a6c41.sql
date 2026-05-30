-- Remove broad default-privilege grants inherited at table creation
REVOKE ALL ON public.exhibitor_events FROM PUBLIC;
REVOKE ALL ON public.exhibitor_events FROM anon;
REVOKE ALL ON public.exhibitor_events FROM authenticated;

-- Re-grant strictly what is needed:
-- authenticated: SELECT only (RLS further restricts rows to admins via is_admin())
GRANT SELECT ON public.exhibitor_events TO authenticated;

-- service_role: full management (edge functions / admin code)
GRANT ALL ON public.exhibitor_events TO service_role;

-- anon: no table privileges at all. Public writes happen only through
-- the SECURITY DEFINER function track_exhibitor_event (EXECUTE already granted).