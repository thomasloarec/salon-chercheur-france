-- Refonte page Nouveautés, lot B1-back (28/09/2026)
-- Provenance d'une nouveauté (origin) et mode d'affichage de son média (display_mode).
-- Additif et réversible. Aucune donnée existante n'est modifiée en dehors du
-- remplissage de la nouvelle colonne origin. updated_at et slug restent intacts.

-- 1. Colonnes ----------------------------------------------------------------
ALTER TABLE public.novelties
  ADD COLUMN IF NOT EXISTS origin text,
  ADD COLUMN IF NOT EXISTS display_mode text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'novelties_origin_check') THEN
    ALTER TABLE public.novelties
      ADD CONSTRAINT novelties_origin_check CHECK (origin IN ('exhibitor', 'lotexpo', 'unknown'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'novelties_display_mode_check') THEN
    ALTER TABLE public.novelties
      ADD CONSTRAINT novelties_display_mode_check CHECK (display_mode IN ('photo', 'typographic'));
  END IF;
END $$;

COMMENT ON COLUMN public.novelties.origin IS
  'Provenance, fixée à la création et jamais réécrite : exhibitor (compte non admin), lotexpo (compte admin), unknown (created_by absent).';
COMMENT ON COLUMN public.novelties.display_mode IS
  'Affichage du média dans les cartes : photo, typographic (composition texte). NULL = automatique (photo si une image existe).';

-- 2. Remplissage de l'historique (avant toute protection de colonne) ----------
-- Le trigger updated_at est suspendu le temps du remplissage : une nouveauté
-- ne doit pas paraître modifiée pour autant.
ALTER TABLE public.novelties DISABLE TRIGGER update_novelties_updated_at;

UPDATE public.novelties n
SET origin = CASE
  WHEN n.created_by IS NULL THEN 'unknown'
  WHEN public.has_role(n.created_by, 'admin'::app_role) THEN 'lotexpo'
  ELSE 'exhibitor'
END
WHERE n.origin IS NULL;

ALTER TABLE public.novelties ENABLE TRIGGER update_novelties_updated_at;

ALTER TABLE public.novelties ALTER COLUMN origin SET NOT NULL;

-- 3. Provenance calculée à chaque création ------------------------------------
CREATE OR REPLACE FUNCTION public.set_novelty_origin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
BEGIN
  IF NEW.origin IS NULL THEN
    IF NEW.created_by IS NULL THEN
      NEW.origin := 'unknown';
    ELSIF public.has_role(NEW.created_by, 'admin'::app_role) THEN
      NEW.origin := 'lotexpo';
    ELSE
      NEW.origin := 'exhibitor';
    END IF;
  END IF;
  RETURN NEW;
END;
$fn$;

REVOKE ALL ON FUNCTION public.set_novelty_origin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_novelty_origin() FROM anon;
REVOKE ALL ON FUNCTION public.set_novelty_origin() FROM authenticated;

DROP TRIGGER IF EXISTS b_set_novelty_origin ON public.novelties;
CREATE TRIGGER b_set_novelty_origin
  BEFORE INSERT ON public.novelties
  FOR EACH ROW EXECUTE FUNCTION public.set_novelty_origin();

-- 4. Verrou : un non-admin ne peut pas réécrire la provenance ------------------
-- Reprise à l'identique de protect_novelty_columns, plus le bloc origin.
CREATE OR REPLACE FUNCTION public.protect_novelty_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Admins can do anything
  IF public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  -- Service role bypass
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Lock sensitive columns for non-admins
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.status := OLD.status;
  END IF;
  IF NEW.exhibitor_id IS DISTINCT FROM OLD.exhibitor_id THEN
    NEW.exhibitor_id := OLD.exhibitor_id;
  END IF;
  IF NEW.event_id IS DISTINCT FROM OLD.event_id THEN
    NEW.event_id := OLD.event_id;
  END IF;
  IF NEW.is_premium IS DISTINCT FROM OLD.is_premium THEN
    NEW.is_premium := OLD.is_premium;
  END IF;
  IF NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    NEW.created_by := OLD.created_by;
  END IF;
  IF NEW.pending_exhibitor_id IS DISTINCT FROM OLD.pending_exhibitor_id THEN
    NEW.pending_exhibitor_id := OLD.pending_exhibitor_id;
  END IF;
  IF NEW.is_test IS DISTINCT FROM OLD.is_test THEN
    NEW.is_test := OLD.is_test;
  END IF;
  IF NEW.origin IS DISTINCT FROM OLD.origin THEN
    NEW.origin := OLD.origin;
  END IF;

  RETURN NEW;
END;
$function$;

NOTIFY pgrst, 'reload schema';

-- RETOUR ARRIÈRE (à exécuter seulement si nécessaire)
-- DROP TRIGGER IF EXISTS b_set_novelty_origin ON public.novelties;
-- DROP FUNCTION IF EXISTS public.set_novelty_origin();
-- (protect_novelty_columns : retirer le bloc origin)
-- ALTER TABLE public.novelties DROP COLUMN IF EXISTS display_mode, DROP COLUMN IF EXISTS origin;
