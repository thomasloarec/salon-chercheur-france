
-- Temporarily disable the protect trigger to allow verified_at seeding
ALTER TABLE public.exhibitors DISABLE TRIGGER protect_exhibitor_columns_trigger;

UPDATE public.exhibitors
SET verified_at = now()
WHERE owner_user_id IS NOT NULL AND verified_at IS NULL;

-- Re-enable
ALTER TABLE public.exhibitors ENABLE TRIGGER protect_exhibitor_columns_trigger;
