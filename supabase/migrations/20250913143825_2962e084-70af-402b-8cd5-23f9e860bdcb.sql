-- Fix migration by handling existing unique constraints properly

-- Add slug column if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sectors' AND column_name='slug') THEN
    ALTER TABLE public.sectors ADD COLUMN slug text;
  END IF;
END $$;

-- Update existing sectors without slugs to have slugs based on their names
UPDATE public.sectors 
SET slug = lower(regexp_replace(regexp_replace(unaccent(name), '[^a-zA-Z0-9\s&-]', '', 'g'), '\s+', '-', 'g'))
WHERE slug IS NULL OR slug = '';

-- Create unique index on slug if not exists (drop first if needed)
DROP INDEX IF EXISTS sectors_slug_unique;
CREATE UNIQUE INDEX sectors_slug_unique ON public.sectors (slug) WHERE slug IS NOT NULL;

-- Insert or update canonical sectors (handling both slug and name conflicts)
DO $$
DECLARE
  canonical_sectors text[][] := ARRAY[
    ARRAY['agroalimentaire-boissons', 'Agroalimentaire & Boissons'],
    ARRAY['automobile-mobilites', 'Automobile & Mobilités'],
    ARRAY['commerce-distribution', 'Commerce & Distribution'],
    ARRAY['cosmetique-bien-etre', 'Cosmétique & Bien-être'],
    ARRAY['education-formation', 'Éducation & Formation'],
    ARRAY['energie-environnement', 'Énergie & Environnement'],
    ARRAY['industrie-production', 'Industrie & Production'],
    ARRAY['mode-textile', 'Mode & Textile'],
    ARRAY['sante-medical', 'Santé & Médical'],
    ARRAY['technologie-innovation', 'Technologie & Innovation'],
    ARRAY['tourisme-evenementiel', 'Tourisme & Événementiel'],
    ARRAY['finance-assurance-immobilier', 'Finance, Assurance & Immobilier'],
    ARRAY['services-entreprises-rh', 'Services aux Entreprises & RH'],
    ARRAY['secteur-public-collectivites', 'Secteur Public & Collectivités']
  ];
  sector_row text[];
BEGIN
  FOREACH sector_row SLICE 1 IN ARRAY canonical_sectors
  LOOP
    -- Try to insert, if conflict on name update slug, if conflict on slug do nothing
    INSERT INTO public.sectors (slug, name) VALUES (sector_row[1], sector_row[2])
    ON CONFLICT (name) DO UPDATE SET slug = sector_row[1]
    ON CONFLICT (slug) DO NOTHING;
  END LOOP;
END $$;