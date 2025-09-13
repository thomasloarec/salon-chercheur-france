-- Ensure sectors table exists with proper structure
CREATE TABLE IF NOT EXISTS public.sectors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  keywords text[],
  created_at timestamp with time zone DEFAULT now()
);

-- Add slug column if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sectors' AND column_name='slug') THEN
    ALTER TABLE public.sectors ADD COLUMN slug text;
  END IF;
END $$;

-- Create unique index on slug if not exists
CREATE UNIQUE INDEX IF NOT EXISTS sectors_slug_unique ON public.sectors (slug);

-- Upsert canonical sectors using name as slug (kebab-case conversion)
INSERT INTO public.sectors (slug, name) VALUES
('agroalimentaire-boissons', 'Agroalimentaire & Boissons'),
('automobile-mobilites', 'Automobile & Mobilités'),
('commerce-distribution', 'Commerce & Distribution'),
('cosmetique-bien-etre', 'Cosmétique & Bien-être'),
('education-formation', 'Éducation & Formation'),
('energie-environnement', 'Énergie & Environnement'),
('industrie-production', 'Industrie & Production'),
('mode-textile', 'Mode & Textile'),
('sante-medical', 'Santé & Médical'),
('technologie-innovation', 'Technologie & Innovation'),
('tourisme-evenementiel', 'Tourisme & Événementiel'),
('finance-assurance-immobilier', 'Finance, Assurance & Immobilier'),
('services-entreprises-rh', 'Services aux Entreprises & RH'),
('secteur-public-collectivites', 'Secteur Public & Collectivités')
ON CONFLICT (slug) DO UPDATE SET 
  name = EXCLUDED.name;

-- Update existing sectors without slugs to have slugs based on their names
UPDATE public.sectors 
SET slug = lower(regexp_replace(regexp_replace(unaccent(name), '[^a-zA-Z0-9\s&-]', '', 'g'), '\s+', '-', 'g'))
WHERE slug IS NULL OR slug = '';

-- Ensure RLS policies exist for public read access
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'sectors' 
    AND policyname = 'Public read access to sectors'
  ) THEN
    CREATE POLICY "Public read access to sectors" ON public.sectors FOR SELECT USING (true);
  END IF;
END $$;

-- Enable RLS if not already enabled
ALTER TABLE public.sectors ENABLE ROW LEVEL SECURITY;