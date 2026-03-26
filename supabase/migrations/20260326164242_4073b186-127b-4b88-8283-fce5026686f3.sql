ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS meta_description_gen text,
  ADD COLUMN IF NOT EXISTS faq_json jsonb,
  ADD COLUMN IF NOT EXISTS enrichissement_score integer,
  ADD COLUMN IF NOT EXISTS enrichissement_statut text,
  ADD COLUMN IF NOT EXISTS enrichissement_date timestamptz;