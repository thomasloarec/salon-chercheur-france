DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'events_auto_validation_status_chk') THEN
    ALTER TABLE public.events
      ADD CONSTRAINT events_auto_validation_status_chk
      CHECK (auto_validation_status IS NULL OR auto_validation_status IN ('passed','warning','failed'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'events_validation_mode_chk') THEN
    ALTER TABLE public.events
      ADD CONSTRAINT events_validation_mode_chk
      CHECK (validation_mode IS NULL OR validation_mode IN ('auto','manual','rejected'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'events_auto_validation_score_chk') THEN
    ALTER TABLE public.events
      ADD CONSTRAINT events_auto_validation_score_chk
      CHECK (auto_validation_score IS NULL OR (auto_validation_score >= 0 AND auto_validation_score <= 100));
  END IF;
END $$;