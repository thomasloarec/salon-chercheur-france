CREATE OR REPLACE FUNCTION public.auto_generate_event_slug()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  base_slug text;
  final_slug text;
  counter integer := 0;
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    base_slug := trim(both '-' from regexp_replace(
      lower(extensions.unaccent(NEW.nom_event)),
      '[^a-z0-9]+', '-', 'g'
    ));
    final_slug := base_slug;
    WHILE EXISTS (SELECT 1 FROM public.events WHERE slug = final_slug AND id != NEW.id) LOOP
      counter := counter + 1;
      final_slug := base_slug || '-' || counter;
    END LOOP;
    NEW.slug := final_slug;
  END IF;
  RETURN NEW;
END;
$$;