-- Lot 5a — Lecture du programme pour l'editeur (organisateur proprietaire OU admin).
-- Jumelle de get_public_event_program mais : (1) garde owner-ou-admin,
-- (2) renvoie TOUS les statuts (brouillons inclus), pour l'edition dans l'espace
-- organisateur. La RPC publique, elle, masque les brouillons aux non-admins.
--
-- Deja appliquee en base via apply_migration le 2026-08-24. Ce fichier est la
-- copie a committer dans supabase/migrations/.

CREATE OR REPLACE FUNCTION public.get_event_program_admin(p_event_id uuid)
 RETURNS TABLE(
   session_id uuid, title text, description text, session_type text,
   day_date date, start_time time without time zone, end_time time without time zone,
   location text, track text, language text, is_highlight boolean,
   registration_url text, session_position integer, status text, speakers jsonb
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
  SELECT
    s.id, s.title, s.description, s.session_type, s.day_date, s.start_time, s.end_time,
    s.location, s.track, s.language, s.is_highlight, s.registration_url, s.position, s.status,
    COALESCE(
      (
        SELECT jsonb_agg(
                 jsonb_build_object(
                   'id', sp.id, 'full_name', sp.full_name, 'job_title', sp.job_title,
                   'company', sp.company, 'bio', sp.bio, 'photo_url', sp.photo_url,
                   'linkedin_url', sp.linkedin_url, 'role', ss.role
                 )
                 ORDER BY ss.position, sp.position
               )
        FROM event_program_session_speakers ss
        JOIN event_program_speakers sp ON sp.id = ss.speaker_id
        WHERE ss.session_id = s.id
      ),
      '[]'::jsonb
    ) AS speakers
  FROM event_program_sessions s
  JOIN ev ON s.event_id = ev.id
  ORDER BY s.day_date NULLS LAST, s.start_time NULLS LAST, s.position, s.created_at;
$function$;

REVOKE ALL ON FUNCTION public.get_event_program_admin(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_event_program_admin(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_event_program_admin(uuid) TO authenticated;
