-- Lot 5b — Liste de TOUS les intervenants d'un evenement (rattaches ou non),
-- pour la reutilisation dans l'editeur de programme (recherche "creer une fois,
-- reutiliser"). Garde owner-ou-admin. Deja appliquee en base via apply_migration
-- le 2026-08-24 ; copie a committer dans supabase/migrations/.

CREATE OR REPLACE FUNCTION public.get_event_speakers_admin(p_event_id uuid)
 RETURNS TABLE(
   id uuid, full_name text, job_title text, company text,
   bio text, photo_url text, linkedin_url text, speaker_position integer
 )
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH ev AS (
    SELECT e.id
    FROM events e
    WHERE e.id = p_event_id
      AND (public.is_admin() OR public.is_event_owner(e.id))
  )
  SELECT sp.id, sp.full_name, sp.job_title, sp.company,
         sp.bio, sp.photo_url, sp.linkedin_url, sp.position
  FROM event_program_speakers sp
  JOIN ev ON sp.event_id = ev.id
  ORDER BY sp.position, sp.full_name;
$function$;

REVOKE ALL ON FUNCTION public.get_event_speakers_admin(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_event_speakers_admin(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_event_speakers_admin(uuid) TO authenticated;
