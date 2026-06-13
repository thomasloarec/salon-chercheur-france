CREATE OR REPLACE VIEW public.v_novelty_visit_signals AS
SELECT
  n.id AS novelty_id,
  n.title AS novelty_title,
  n.event_id,
  e.nom_event,
  e.date_debut,
  n.exhibitor_id,
  x.name AS exhibitor_name,
  COUNT(l.id) AS total_likes,
  COUNT(DISTINCT l.user_id) AS distinct_visitors,
  m.highest_milestone,
  MAX(l.created_at) AS last_signal_at
FROM public.novelties n
JOIN public.novelty_likes l ON l.novelty_id = n.id
LEFT JOIN public.events e ON e.id = n.event_id
LEFT JOIN public.exhibitors x ON x.id = n.exhibitor_id
LEFT JOIN (
  SELECT novelty_id, MAX(threshold) AS highest_milestone
  FROM public.novelty_visit_milestones
  GROUP BY novelty_id
) m ON m.novelty_id = n.id
GROUP BY n.id, n.title, n.event_id, e.nom_event, e.date_debut, n.exhibitor_id, x.name, m.highest_milestone
ORDER BY distinct_visitors DESC, last_signal_at DESC;

REVOKE ALL ON public.v_novelty_visit_signals FROM anon, authenticated;
GRANT SELECT ON public.v_novelty_visit_signals TO service_role;