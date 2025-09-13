-- Add missing function for top novelties per event
CREATE OR REPLACE FUNCTION public.get_top_novelties_per_event()
RETURNS TABLE(
  id uuid,
  event_id uuid,
  exhibitor_id uuid,
  title text,
  type text,
  reason_1 text,
  reason_2 text,
  reason_3 text,
  audience_tags text[],
  media_urls text[],
  doc_url text,
  availability text,
  stand_info text,
  demo_slots jsonb,
  status text,
  created_at timestamptz,
  updated_at timestamptz,
  exhibitors jsonb,
  novelty_stats jsonb,
  events jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH ranked_novelties AS (
    SELECT 
      n.*,
      ROW_NUMBER() OVER (
        PARTITION BY n.event_id 
        ORDER BY COALESCE(ns.popularity_score, 0) DESC, n.created_at DESC
      ) as rn,
      to_jsonb(e.*) as exhibitors,
      to_jsonb(ns.*) as novelty_stats,
      to_jsonb(ev.*) as events
    FROM novelties n
    LEFT JOIN novelty_stats ns ON ns.novelty_id = n.id
    JOIN exhibitors e ON e.id = n.exhibitor_id
    JOIN events ev ON ev.id = n.event_id
    WHERE n.status = 'Published'
      AND ev.visible = true
      AND COALESCE(ev.date_debut, '0001-01-01'::date) >= CURRENT_DATE
  )
  SELECT 
    rn.id,
    rn.event_id,
    rn.exhibitor_id,
    rn.title,
    rn.type,
    rn.reason_1,
    rn.reason_2,
    rn.reason_3,
    rn.audience_tags,
    rn.media_urls,
    rn.doc_url,
    rn.availability,
    rn.stand_info,
    rn.demo_slots,
    rn.status,
    rn.created_at,
    rn.updated_at,
    rn.exhibitors,
    rn.novelty_stats,
    rn.events
  FROM ranked_novelties rn
  WHERE rn.rn = 1
  ORDER BY COALESCE((rn.novelty_stats->>'popularity_score')::numeric, 0) DESC, rn.created_at DESC;
$$;