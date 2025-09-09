-- HOTFIX: Make legacy sectors column nullable to allow UPSERT operations

-- 0) Ensure target columns for new model
ALTER TABLE public.newsletter_subscriptions
  ALTER COLUMN email SET NOT NULL;

-- Add sector_id if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public'
      AND table_name='newsletter_subscriptions'
      AND column_name='sector_id'
  ) THEN
    ALTER TABLE public.newsletter_subscriptions
      ADD COLUMN sector_id uuid;
  END IF;
END$$;

-- 1) HOTFIX: Make legacy "sectors" column optional (remove NOT NULL)
DO $$
DECLARE
  col_type text;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public'
      AND table_name='newsletter_subscriptions'
      AND column_name='sectors'
  ) THEN
    -- Remove NOT NULL constraint
    ALTER TABLE public.newsletter_subscriptions
      ALTER COLUMN sectors DROP NOT NULL;

    -- Optional: set harmless DEFAULT to avoid implicit NULL
    SELECT data_type INTO col_type
    FROM information_schema.columns
    WHERE table_schema='public'
      AND table_name='newsletter_subscriptions'
      AND column_name='sectors';

    -- If it's a text array, set default to NULL
    BEGIN
      ALTER TABLE public.newsletter_subscriptions
        ALTER COLUMN sectors SET DEFAULT NULL;
    EXCEPTION WHEN others THEN
      -- ignore: don't break anything if type is not manageable; DROP NOT NULL is enough
      NULL;
    END;
  END IF;
END$$;

-- 2) Composite uniqueness (email, sector_id) - enables UPSERT
--    (Remove simple uniqueness on email if it still exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.newsletter_subscriptions'::regclass
      AND conname  = 'newsletter_subscriptions_email_key'
  ) THEN
    ALTER TABLE public.newsletter_subscriptions
      DROP CONSTRAINT newsletter_subscriptions_email_key;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.newsletter_subscriptions'::regclass
      AND conname  = 'newsletter_subscriptions_email_sector_id_key'
  ) THEN
    ALTER TABLE public.newsletter_subscriptions
      ADD CONSTRAINT newsletter_subscriptions_email_sector_id_key
      UNIQUE (email, sector_id);
  END IF;
END$$;

-- 3) FK to sectors(id) if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.newsletter_subscriptions'::regclass
      AND conname  = 'newsletter_subscriptions_sector_id_fkey'
  ) THEN
    ALTER TABLE public.newsletter_subscriptions
      ADD CONSTRAINT newsletter_subscriptions_sector_id_fkey
      FOREIGN KEY (sector_id) REFERENCES public.sectors(id) ON DELETE CASCADE;
  END IF;
END$$;

-- 4) Performance index
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname='public' AND indexname='newsletter_subscriptions_email_idx'
  ) THEN
    CREATE INDEX newsletter_subscriptions_email_idx
      ON public.newsletter_subscriptions(email);
  END IF;
END$$;