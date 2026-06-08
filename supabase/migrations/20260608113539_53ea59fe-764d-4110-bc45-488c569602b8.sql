CREATE OR REPLACE FUNCTION public.get_admin_leads_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  -- Garde absolue : seuls les admins peuvent obtenir ces données
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  SELECT jsonb_build_object(
    -- Totals calculés sur le MÊME périmètre que by_novelty (INNER JOIN sur novelties)
    'totals', (
      SELECT jsonb_build_object(
        'total_leads', COUNT(*),
        'total_rdv', COUNT(*) FILTER (WHERE l.lead_type = 'meeting_request'),
        'total_brochure', COUNT(*) FILTER (WHERE l.lead_type = 'resource_download')
      )
      FROM public.leads l
      JOIN public.novelties n ON n.id = l.novelty_id
    ),
    'by_novelty', (
      SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.leads_total DESC), '[]'::jsonb)
      FROM (
        SELECT
          n.id AS novelty_id,
          n.title AS novelty_title,
          n.slug AS novelty_slug,
          ex.name AS exhibitor_name,
          ev.nom_event AS event_name,
          COUNT(l.id) AS leads_total,
          COUNT(l.id) FILTER (WHERE l.lead_type = 'meeting_request') AS leads_rdv,
          COUNT(l.id) FILTER (WHERE l.lead_type = 'resource_download') AS leads_brochure
        FROM public.leads l
        JOIN public.novelties n ON n.id = l.novelty_id
        LEFT JOIN public.exhibitors ex ON ex.id = n.exhibitor_id
        LEFT JOIN public.events ev ON ev.id = n.event_id
        GROUP BY n.id, n.title, n.slug, ex.name, ev.nom_event
      ) t
    )
  )
  INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_admin_leads_stats() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_admin_leads_stats() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_admin_leads_stats() TO authenticated;