CREATE OR REPLACE FUNCTION public.rollup_ai_search_daily(
  p_day date DEFAULT (CURRENT_DATE - 1)
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $fn$
BEGIN
  INSERT INTO ai_search_daily_agg
    (day, macro_sector_id, sub_sector_id, intent_type, query_count, no_result_count)
  SELECT p_day,
    COALESCE(e.macro_sector_id, '00000000-0000-0000-0000-000000000000'),
    COALESCE(s.sub_id, '00000000-0000-0000-0000-000000000000'),
    COALESCE(e.intent_type, 'autre'),
    count(*),
    count(*) FILTER (WHERE e.answer_had_results = false)
  FROM ai_search_events e
  LEFT JOIN LATERAL unnest(COALESCE(e.sub_sector_ids, ARRAY[]::uuid[])) AS s(sub_id) ON true
  WHERE e.occurred_hour >= p_day AND e.occurred_hour < p_day + 1
  GROUP BY 2, 3, 4
  ON CONFLICT ON CONSTRAINT ai_search_daily_agg_uniq
  DO UPDATE SET query_count = EXCLUDED.query_count,
    no_result_count = EXCLUDED.no_result_count, updated_at = now();

  INSERT INTO ai_event_visibility_daily (day, event_id, appearances)
  SELECT p_day, m.event_id, count(*)
  FROM ai_search_events e
  CROSS JOIN LATERAL unnest(COALESCE(e.matched_event_ids, ARRAY[]::uuid[])) AS m(event_id)
  WHERE e.occurred_hour >= p_day AND e.occurred_hour < p_day + 1
  GROUP BY m.event_id
  ON CONFLICT ON CONSTRAINT ai_event_visibility_daily_uniq
  DO UPDATE SET appearances = EXCLUDED.appearances, updated_at = now();

  UPDATE ai_event_visibility_daily v
  SET sector_query_count = sub.qc, no_result_sector_count = sub.nrc, updated_at = now()
  FROM (
    SELECT es.event_id, sum(a.query_count) AS qc, sum(a.no_result_count) AS nrc
    FROM ai_search_daily_agg a
    JOIN event_sectors es ON es.sector_id = a.macro_sector_id
    WHERE a.day = p_day AND a.sub_sector_id = '00000000-0000-0000-0000-000000000000'
    GROUP BY es.event_id
  ) sub
  WHERE v.event_id = sub.event_id AND v.day = p_day;

  INSERT INTO ai_event_visibility_daily
    (day, event_id, appearances, sector_query_count, no_result_sector_count)
  SELECT p_day, es.event_id, 0, sum(a.query_count), sum(a.no_result_count)
  FROM ai_search_daily_agg a
  JOIN event_sectors es ON es.sector_id = a.macro_sector_id
  WHERE a.day = p_day AND a.sub_sector_id = '00000000-0000-0000-0000-000000000000'
  GROUP BY es.event_id
  ON CONFLICT ON CONSTRAINT ai_event_visibility_daily_uniq
  DO NOTHING;
END; $fn$;