UPDATE public.ai_search_usage SET question = NULL, ip = NULL;

DROP INDEX IF EXISTS public.idx_ai_search_usage_ip_created;

ALTER TABLE public.ai_search_usage DROP COLUMN IF EXISTS question;

ALTER TABLE public.ai_search_usage DROP COLUMN IF EXISTS ip;