
-- Extension pour enlever les accents (au cas où)
CREATE EXTENSION IF NOT EXISTS unaccent;

-- (Re)crée un trigger qui extrait la ville depuis l'adresse
CREATE OR REPLACE FUNCTION fill_city_from_address()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  extracted TEXT;
BEGIN
  /* Cherche le code postal à 5 chiffres, puis espace / virgule / tiret éventuel,
     et prend tout le texte qui suit. */
  SELECT trim(
           unaccent(
             regexp_replace(NEW.address, '.*\d{5}[ ,\-]+', '')
           )
         )
  INTO extracted;

  IF extracted <> '' THEN
    NEW.city := initcap(extracted);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fill_city ON public.events;
CREATE TRIGGER trg_fill_city
BEFORE INSERT OR UPDATE ON public.events
FOR EACH ROW EXECUTE FUNCTION fill_city_from_address();

-- Remplir ou corriger la colonne city pour les anciens enregistrements
UPDATE public.events
SET    city = initcap(
         trim(
           unaccent(regexp_replace(address, '.*\d{5}[ ,\-]+', ''))
         )
       )
WHERE  city IS NULL
   OR  city = ''
   OR  city LIKE '%Champagne%'   -- corrige l'exemple Châlons-en-Champagne ➜ Caen
;
