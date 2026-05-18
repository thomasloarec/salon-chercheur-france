ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS auto_validation_status text,
  ADD COLUMN IF NOT EXISTS auto_validation_score integer,
  ADD COLUMN IF NOT EXISTS auto_validation_report jsonb,
  ADD COLUMN IF NOT EXISTS auto_validated_at timestamptz,
  ADD COLUMN IF NOT EXISTS validation_mode text;