SELECT cron.schedule('rollup-ai-search-daily', '47 3 * * *',
  $$SELECT public.rollup_ai_search_daily()$$);

SELECT cron.schedule('retention-ai-search-events', '31 4 2 * *',
  $$UPDATE public.ai_search_events
    SET query_sanitized = NULL, query_embedding = NULL
    WHERE occurred_hour < now() - interval '24 months'
      AND (query_sanitized IS NOT NULL OR query_embedding IS NOT NULL)$$);

SELECT cron.schedule('purge-ai-rate-limit-hits', '0 */6 * * *',
  $$DELETE FROM public.ai_rate_limit_hits WHERE created_at < now() - interval '48 hours'$$);