CREATE OR REPLACE FUNCTION public.count_novelty_distinct_visitors(p_novelty_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(DISTINCT nl.user_id)::int
  FROM novelty_likes nl
  WHERE nl.novelty_id = p_novelty_id
    AND nl.user_id <> COALESCE(
      (SELECT created_by FROM novelties WHERE id = p_novelty_id),
      '00000000-0000-0000-0000-000000000000'::uuid
    )
    AND nl.user_id NOT IN (
      SELECT tm.user_id
      FROM exhibitor_team_members tm
      JOIN novelties n ON n.id = p_novelty_id
      WHERE tm.exhibitor_id = n.exhibitor_id
        AND tm.status = 'active'
    );
$$;

CREATE OR REPLACE FUNCTION public.try_record_novelty_milestone(p_novelty_id uuid, p_threshold integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO novelty_visit_milestones (novelty_id, threshold)
  VALUES (p_novelty_id, p_threshold)
  ON CONFLICT (novelty_id, threshold) DO NOTHING;
  RETURN FOUND;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.count_novelty_distinct_visitors(uuid) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.try_record_novelty_milestone(uuid, integer) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.count_novelty_distinct_visitors(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.try_record_novelty_milestone(uuid, integer) TO service_role;