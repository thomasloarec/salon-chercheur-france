
-- Add missing columns to events table
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS enrichissement_niveau text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS description_enrichie text DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.events.enrichissement_niveau IS 'Niveau de priorité SEO: premium | standard | minimal';
COMMENT ON COLUMN public.events.description_enrichie IS 'Description enrichie par IA pour SEO';
