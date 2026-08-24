-- =====================================================================
-- Lot 3 : socle backend du Programme
-- Applique en production le 23/08/2026 via Supabase MCP.
-- Trace a committer dans supabase/migrations/.
--
-- Contenu :
--   1. Trois tables (sessions, intervenants, jointure N:N) + RLS
--   2. RPC publique get_public_event_program (lecture, garde visible/admin)
--   3. RPC get_event_program_count (pilotage affichage section)
--   4. Bucket storage program-speakers (photos intervenants)
--
-- Edge Function associee (deployee separement) : event-program-manage v1.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------
CREATE TABLE public.event_program_sessions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  title         text NOT NULL,
  description   text,
  session_type  text NOT NULL DEFAULT 'conference'
                  CHECK (session_type IN ('keynote','conference','table_ronde','atelier','demo','remise_prix','networking','autre')),
  day_date      date,
  start_time    time,
  end_time      time,
  location      text,
  track         text,
  language      text,
  is_highlight  boolean NOT NULL DEFAULT false,
  registration_url text,
  position      integer NOT NULL DEFAULT 0,
  status        text NOT NULL DEFAULT 'published' CHECK (status IN ('draft','published')),
  source        text NOT NULL DEFAULT 'organizer' CHECK (source IN ('organizer','pdf_import','admin')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_program_sessions_event ON public.event_program_sessions (event_id, status);
CREATE INDEX idx_program_sessions_order ON public.event_program_sessions (event_id, day_date NULLS LAST, start_time NULLS LAST, position);

CREATE TABLE public.event_program_speakers (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  full_name     text NOT NULL,
  job_title     text,
  company       text,
  bio           text,
  photo_url     text,
  linkedin_url  text,
  position      integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_program_speakers_event ON public.event_program_speakers (event_id, position);

CREATE TABLE public.event_program_session_speakers (
  session_id  uuid NOT NULL REFERENCES public.event_program_sessions(id) ON DELETE CASCADE,
  speaker_id  uuid NOT NULL REFERENCES public.event_program_speakers(id) ON DELETE CASCADE,
  role        text NOT NULL DEFAULT 'intervenant'
                CHECK (role IN ('intervenant','moderateur','interviewe','animateur')),
  position    integer NOT NULL DEFAULT 0,
  PRIMARY KEY (session_id, speaker_id)
);

CREATE INDEX idx_program_session_speakers_speaker ON public.event_program_session_speakers (speaker_id);

-- ---------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.touch_program_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_program_sessions_updated
  BEFORE UPDATE ON public.event_program_sessions
  FOR EACH ROW EXECUTE FUNCTION public.touch_program_updated_at();

CREATE TRIGGER trg_program_speakers_updated
  BEFORE UPDATE ON public.event_program_speakers
  FOR EACH ROW EXECUTE FUNCTION public.touch_program_updated_at();

-- ---------------------------------------------------------------------
-- RLS : lecture via RPC, ecriture admin/service_role uniquement
-- ---------------------------------------------------------------------
ALTER TABLE public.event_program_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_program_speakers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_program_session_speakers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage program sessions" ON public.event_program_sessions
  FOR ALL TO public USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Service role manages program sessions" ON public.event_program_sessions
  FOR ALL TO public USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Admins manage program speakers" ON public.event_program_speakers
  FOR ALL TO public USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Service role manages program speakers" ON public.event_program_speakers
  FOR ALL TO public USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Admins manage program session_speakers" ON public.event_program_session_speakers
  FOR ALL TO public USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Service role manages program session_speakers" ON public.event_program_session_speakers
  FOR ALL TO public USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- ---------------------------------------------------------------------
-- 2. Lecture publique (garde (visible AND NOT is_test) OR is_admin).
--    Attention : la colonne de retour de la position est nommee
--    session_position (position est reserve dans un RETURNS TABLE).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_public_event_program(p_event_id uuid)
RETURNS TABLE (
  session_id       uuid,
  title            text,
  description      text,
  session_type     text,
  day_date         date,
  start_time       time,
  end_time         time,
  location         text,
  track            text,
  language         text,
  is_highlight     boolean,
  registration_url text,
  session_position integer,
  status           text,
  speakers         jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH ev AS (
    SELECT e.id, public.is_admin() AS is_adm
    FROM events e
    WHERE e.id = p_event_id
      AND ((e.visible IS TRUE AND e.is_test IS FALSE) OR public.is_admin())
  )
  SELECT
    s.id, s.title, s.description, s.session_type, s.day_date, s.start_time,
    s.end_time, s.location, s.track, s.language, s.is_highlight,
    s.registration_url, s.position, s.status,
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
  WHERE s.status = 'published' OR ev.is_adm
  ORDER BY s.day_date NULLS LAST, s.start_time NULLS LAST, s.position, s.created_at;
$function$;

REVOKE ALL ON FUNCTION public.get_public_event_program(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.get_public_event_program(uuid) TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------
-- 3. Compteur pour piloter l'affichage de la section
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_event_program_count(p_event_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT count(*)::int
  FROM event_program_sessions s
  JOIN events e ON e.id = s.event_id
  WHERE s.event_id = p_event_id
    AND ((e.visible IS TRUE AND e.is_test IS FALSE) OR public.is_admin())
    AND (s.status = 'published' OR public.is_admin());
$function$;

REVOKE ALL ON FUNCTION public.get_event_program_count(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.get_event_program_count(uuid) TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------
-- 4. Bucket storage pour les photos d'intervenants
-- ---------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('program-speakers', 'program-speakers', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read program speaker photos"
  ON storage.objects FOR SELECT TO public USING (bucket_id = 'program-speakers');
CREATE POLICY "Authenticated upload program speaker photos"
  ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'program-speakers');
CREATE POLICY "Authenticated update program speaker photos"
  ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'program-speakers');
CREATE POLICY "Authenticated delete program speaker photos"
  ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'program-speakers');

-- =====================================================================
-- Rollback
-- =====================================================================
-- DROP FUNCTION IF EXISTS public.get_public_event_program(uuid);
-- DROP FUNCTION IF EXISTS public.get_event_program_count(uuid);
-- DROP TABLE IF EXISTS public.event_program_session_speakers;
-- DROP TABLE IF EXISTS public.event_program_sessions;
-- DROP TABLE IF EXISTS public.event_program_speakers;
-- DROP FUNCTION IF EXISTS public.touch_program_updated_at();
-- (bucket + policies storage a retirer separement si besoin)
