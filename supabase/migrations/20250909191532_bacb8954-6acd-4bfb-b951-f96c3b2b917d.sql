-- Fix newsletter_subscriptions unique constraint: change from email-only to (email, sector_id) composite

-- 0) Ensure required columns and constraints
ALTER TABLE public.newsletter_subscriptions
  ALTER COLUMN email SET NOT NULL;

-- Add sector_id column if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'newsletter_subscriptions'
      AND column_name  = 'sector_id'
  ) THEN
    ALTER TABLE public.newsletter_subscriptions
      ADD COLUMN sector_id uuid;
  END IF;
END$$;

-- 1) Add foreign key to sectors(id) if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'newsletter_subscriptions_sector_id_fkey'
  ) THEN
    ALTER TABLE public.newsletter_subscriptions
      ADD CONSTRAINT newsletter_subscriptions_sector_id_fkey
      FOREIGN KEY (sector_id)
      REFERENCES public.sectors(id)
      ON DELETE CASCADE;
  END IF;
END$$;

-- 2) Remove simple unique constraint on email
DO $$
DECLARE
  con_exists boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'newsletter_subscriptions_email_key'
  ) INTO con_exists;

  IF con_exists THEN
    -- It was a UNIQUE constraint
    ALTER TABLE public.newsletter_subscriptions
      DROP CONSTRAINT newsletter_subscriptions_email_key;
  ELSE
    -- Try to drop a unique index with this name
    PERFORM 1 FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname  = 'newsletter_subscriptions_email_key';
    IF FOUND THEN
      DROP INDEX IF EXISTS public.newsletter_subscriptions_email_key;
    END IF;
  END IF;
END$$;

-- 3) Create composite unique constraint (email, sector_id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'newsletter_subscriptions_email_sector_id_key'
  ) THEN
    ALTER TABLE public.newsletter_subscriptions
      ADD CONSTRAINT newsletter_subscriptions_email_sector_id_key
      UNIQUE (email, sector_id);
  END IF;
END$$;

-- 4) Add performance index on email
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'newsletter_subscriptions_email_idx'
  ) THEN
    CREATE INDEX newsletter_subscriptions_email_idx
      ON public.newsletter_subscriptions (email);
  END IF;
END$$;