-- 1. Fix the auto_generate_event_slug trigger to use unaccent()
CREATE OR REPLACE FUNCTION public.auto_generate_event_slug()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  base_slug text;
  final_slug text;
  counter integer := 0;
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    base_slug := trim(both '-' from regexp_replace(
      lower(unaccent(NEW.nom_event)),
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

-- 2. Create redirect mapping table for old broken slugs
CREATE TABLE IF NOT EXISTS public.slug_redirects (
  old_slug text PRIMARY KEY,
  new_slug text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.slug_redirects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read slug_redirects"
  ON public.slug_redirects FOR SELECT
  TO anon, authenticated
  USING (true);

-- 3. Regenerate broken slugs and store redirect mappings
DO $$
DECLARE
  r record;
  new_slug text;
  base_slug text;
  counter integer;
BEGIN
  FOR r IN
    SELECT id, slug, nom_event
    FROM public.events
    WHERE slug IS NOT NULL
      AND slug != ''
      AND slug != trim(both '-' from regexp_replace(lower(unaccent(nom_event)), '[^a-z0-9]+', '-', 'g'))
  LOOP
    base_slug := trim(both '-' from regexp_replace(lower(unaccent(r.nom_event)), '[^a-z0-9]+', '-', 'g'));
    new_slug := base_slug;
    counter := 0;

    WHILE EXISTS (SELECT 1 FROM public.events WHERE slug = new_slug AND id != r.id) LOOP
      counter := counter + 1;
      new_slug := base_slug || '-' || counter;
    END LOOP;

    IF new_slug != r.slug THEN
      INSERT INTO public.slug_redirects (old_slug, new_slug)
      VALUES (r.slug, new_slug)
      ON CONFLICT (old_slug) DO NOTHING;

      UPDATE public.events SET slug = new_slug WHERE id = r.id;
    END IF;
  END LOOP;
END;
$$;