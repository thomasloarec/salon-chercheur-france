
-- Remplacer la fonction par une version idempotente
CREATE OR REPLACE FUNCTION public.fill_city_and_postal_from_address()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- Ne modifier postal_code que s'il est vide/nul
  IF NEW.postal_code IS NULL OR trim(NEW.postal_code) = '' THEN
    NEW.postal_code := substring(NEW.address FROM '(\d{5})');
  END IF;
  
  -- Ne modifier city que s'il est vide/nul
  IF NEW.city IS NULL OR trim(NEW.city) = '' THEN
    NEW.city := initcap(trim(
                  unaccent(regexp_replace(NEW.address, '.*\d{5}[ ,\-]+', ''))
                ));
  END IF;
  
  -- Log temporaire pour diagnostic
  RAISE NOTICE '🌍 after fill_city trigger: %, %, %',
               NEW.address, NEW.postal_code, NEW.city;
  
  RETURN NEW;
END;
$$;
