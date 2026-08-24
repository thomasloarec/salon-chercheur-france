-- Lot 7-bis — Publication en masse des sessions en brouillon d'un evenement.
-- Passe tous les brouillons -> published en une seule operation. Garde owner-ou-admin.
-- Deja appliquee en base via apply_migration le 2026-08-24.

CREATE OR REPLACE FUNCTION public.publish_event_program_sessions(p_event_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_count integer;
BEGIN
  IF NOT (public.is_admin() OR public.is_event_owner(p_event_id)) THEN
    RAISE EXCEPTION 'Acces refuse.';
  END IF;
  UPDATE public.event_program_sessions
  SET status = 'published'
  WHERE event_id = p_event_id AND status = 'draft';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$function$;

REVOKE ALL ON FUNCTION public.publish_event_program_sessions(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.publish_event_program_sessions(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.publish_event_program_sessions(uuid) TO authenticated;
