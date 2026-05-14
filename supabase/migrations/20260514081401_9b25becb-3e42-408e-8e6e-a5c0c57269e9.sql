ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_category_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_category_check
  CHECK (category = ANY (ARRAY['interaction'::text, 'lead'::text, 'favorite_event'::text, 'exhibitor_mgmt'::text, 'system'::text, 'recommendation'::text, 'radar_crm'::text]));