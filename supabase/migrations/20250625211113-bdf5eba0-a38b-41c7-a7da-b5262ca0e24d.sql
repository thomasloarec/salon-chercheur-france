
-- 1. Supprimer l'ancienne vue events_geo pour éviter les conflits
DROP VIEW IF EXISTS public.events_geo;

-- 2. Ajout du code postal si absent
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS postal_code TEXT;

-- 3. Trigger amélioré : extrait ville + postal_code
CREATE OR REPLACE FUNCTION fill_city_and_postal_from_address()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.postal_code := substring(NEW.address FROM '(\d{5})');
  NEW.city        := initcap(trim(
                     unaccent(regexp_replace(NEW.address, '.*\d{5}[ ,\-]+', ''))
                   ));
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_fill_city ON public.events;
CREATE TRIGGER trg_fill_city
BEFORE INSERT OR UPDATE ON public.events
FOR EACH ROW EXECUTE FUNCTION fill_city_and_postal_from_address();

-- 4. Créer la nouvelle vue events_geo avec jointure fiable
CREATE OR REPLACE VIEW public.events_geo AS
SELECT  e.*,
        c.id          AS commune_id,
        c.dep_code    AS dep_code,
        d.region_code AS region_code
FROM    public.events e
JOIN LATERAL (
  SELECT *
  FROM   communes
  WHERE  (e.postal_code IS NOT NULL AND code_postal = e.postal_code)
     OR  LOWER(unaccent(nom)) = LOWER(unaccent(e.city))
  ORDER  BY (code_postal = e.postal_code) DESC
  LIMIT 1
) c  ON true
JOIN   public.departements d ON d.code = c.dep_code;

-- 5. Mise à jour rétroactive (une fois)
UPDATE public.events
SET    postal_code = substring(address FROM '(\d{5})')
WHERE  postal_code IS NULL;
