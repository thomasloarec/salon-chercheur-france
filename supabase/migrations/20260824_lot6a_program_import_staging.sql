-- Lot 6a — Infrastructure d'import PDF de programme (staging).
-- Table de staging : un import = un PDF soumis pour un evenement. L'extraction IA
-- y depose son resultat structure ; l'application (lot 6b) le materialise en sessions.
-- Deja appliquee en base via apply_migration le 2026-08-24.

CREATE TABLE IF NOT EXISTS public.staging_program_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','extracting','extracted','applied','failed')),
  pdf_path text,
  original_filename text,
  model text,
  result jsonb,
  error text,
  created_by uuid,
  applied_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_staging_program_imports_event
  ON public.staging_program_imports (event_id, created_at DESC);

ALTER TABLE public.staging_program_imports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage program imports"
  ON public.staging_program_imports FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Service role manages program imports"
  ON public.staging_program_imports FOR ALL
  TO service_role USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS trg_staging_program_imports_updated ON public.staging_program_imports;
CREATE TRIGGER trg_staging_program_imports_updated
  BEFORE UPDATE ON public.staging_program_imports
  FOR EACH ROW EXECUTE FUNCTION public.touch_program_updated_at();

INSERT INTO storage.buckets (id, name, public)
VALUES ('program-imports', 'program-imports', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated upload program import pdf"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'program-imports');

CREATE POLICY "Authenticated read own program import pdf"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'program-imports');

CREATE OR REPLACE FUNCTION public.get_program_import_admin(p_import_id uuid)
 RETURNS TABLE(
   id uuid, event_id uuid, status text, original_filename text,
   model text, result jsonb, error text, created_at timestamptz, applied_at timestamptz
 )
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT i.id, i.event_id, i.status, i.original_filename,
         i.model, i.result, i.error, i.created_at, i.applied_at
  FROM public.staging_program_imports i
  JOIN public.events e ON e.id = i.event_id
  WHERE i.id = p_import_id
    AND (public.is_admin() OR public.is_event_owner(e.id));
$function$;

REVOKE ALL ON FUNCTION public.get_program_import_admin(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_program_import_admin(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_program_import_admin(uuid) TO authenticated;
