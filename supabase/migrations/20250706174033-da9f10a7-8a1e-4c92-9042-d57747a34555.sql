
CREATE OR REPLACE FUNCTION public.fill_city_and_postal_from_address()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- Ne remplir que si la valeur est absente ou vide
  IF NEW.postal_code IS NULL OR NEW.postal_code = '' THEN
    NEW.postal_code := substring(NEW.address FROM '(\d{5})');
  END IF;

  IF NEW.city IS NULL OR NEW.city = '' THEN
    NEW.city := initcap(trim(
      unaccent(regexp_replace(NEW.address, '.*\d{5}[ ,\-]+', ''))
    ));
  END IF;

  RETURN NEW;
END;
$$;
