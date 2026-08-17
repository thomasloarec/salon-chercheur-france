-- 1) Backfill: create missing public identities for exhibitors with published novelties
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT DISTINCT e.id
    FROM public.novelties n
    JOIN public.exhibitors e ON e.id = n.exhibitor_id
    LEFT JOIN public.exhibitor_public_identities i ON i.exhibitor_id = e.id
    WHERE n.status = 'published' AND i.id IS NULL
  LOOP
    PERFORM public.ensure_exhibitor_public_identity(p_exhibitor_id => r.id);
  END LOOP;
END $$;

-- 2) Prevention: ensure a public identity exists whenever a novelty is published
CREATE OR REPLACE FUNCTION public.tg_novelty_ensure_public_identity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'published' AND NEW.exhibitor_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.exhibitor_public_identities WHERE exhibitor_id = NEW.exhibitor_id
    ) THEN
      BEGIN
        PERFORM public.ensure_exhibitor_public_identity(p_exhibitor_id => NEW.exhibitor_id);
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'ensure_exhibitor_public_identity failed for %: %', NEW.exhibitor_id, SQLERRM;
      END;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS novelty_ensure_public_identity ON public.novelties;
CREATE TRIGGER novelty_ensure_public_identity
AFTER INSERT OR UPDATE OF status ON public.novelties
FOR EACH ROW EXECUTE FUNCTION public.tg_novelty_ensure_public_identity();