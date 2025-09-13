-- Simple migration to add slug and populate canonical sectors

-- Add slug column if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sectors' AND column_name='slug') THEN
    ALTER TABLE public.sectors ADD COLUMN slug text;
  END IF;
END $$;

-- Update existing sectors without slugs
UPDATE public.sectors 
SET slug = lower(regexp_replace(regexp_replace(unaccent(name), '[^a-zA-Z0-9\s&-]', '', 'g'), '\s+', '-', 'g'))
WHERE slug IS NULL OR slug = '';

-- Create unique index on slug if not exists
DROP INDEX IF EXISTS sectors_slug_unique;
CREATE UNIQUE INDEX sectors_slug_unique ON public.sectors (slug) WHERE slug IS NOT NULL;

-- Insert missing canonical sectors one by one
INSERT INTO public.sectors (slug, name) VALUES ('agroalimentaire-boissons', 'Agroalimentaire & Boissons') ON CONFLICT (slug) DO NOTHING;
INSERT INTO public.sectors (slug, name) VALUES ('automobile-mobilites', 'Automobile & Mobilités') ON CONFLICT (slug) DO NOTHING;
INSERT INTO public.sectors (slug, name) VALUES ('commerce-distribution', 'Commerce & Distribution') ON CONFLICT (slug) DO NOTHING;
INSERT INTO public.sectors (slug, name) VALUES ('cosmetique-bien-etre', 'Cosmétique & Bien-être') ON CONFLICT (slug) DO NOTHING;
INSERT INTO public.sectors (slug, name) VALUES ('education-formation', 'Éducation & Formation') ON CONFLICT (slug) DO NOTHING;
INSERT INTO public.sectors (slug, name) VALUES ('energie-environnement', 'Énergie & Environnement') ON CONFLICT (slug) DO NOTHING;
INSERT INTO public.sectors (slug, name) VALUES ('industrie-production', 'Industrie & Production') ON CONFLICT (slug) DO NOTHING;
INSERT INTO public.sectors (slug, name) VALUES ('mode-textile', 'Mode & Textile') ON CONFLICT (slug) DO NOTHING;
INSERT INTO public.sectors (slug, name) VALUES ('sante-medical', 'Santé & Médical') ON CONFLICT (slug) DO NOTHING;
INSERT INTO public.sectors (slug, name) VALUES ('technologie-innovation', 'Technologie & Innovation') ON CONFLICT (slug) DO NOTHING;
INSERT INTO public.sectors (slug, name) VALUES ('tourisme-evenementiel', 'Tourisme & Événementiel') ON CONFLICT (slug) DO NOTHING;
INSERT INTO public.sectors (slug, name) VALUES ('finance-assurance-immobilier', 'Finance, Assurance & Immobilier') ON CONFLICT (slug) DO NOTHING;
INSERT INTO public.sectors (slug, name) VALUES ('services-entreprises-rh', 'Services aux Entreprises & RH') ON CONFLICT (slug) DO NOTHING;
INSERT INTO public.sectors (slug, name) VALUES ('secteur-public-collectivites', 'Secteur Public & Collectivités') ON CONFLICT (slug) DO NOTHING;