-- Lotexpo Leads, Lot 11A : comparaison entre salons et export complet d'un salon.
-- Purement additif : 3 fonctions nouvelles. Aucune table ni fonction existante modifiée.
-- Les deux fonctions appelables sont réservées aux managers et aux formules payantes (bêta, Pass, Annuel).

-- =========================================================================
-- 1. Nom lisible d'un utilisateur (interne)
-- =========================================================================
CREATE OR REPLACE FUNCTION public._booth_user_label(p_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(
    nullif(btrim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')), ''),
    u.email
  )
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.user_id = u.id
  WHERE u.id = p_user_id
$$;

REVOKE ALL ON FUNCTION public._booth_user_label(uuid) FROM PUBLIC, anon, authenticated;

-- =========================================================================
-- 2. Comparaison entre salons d'un exposant
-- =========================================================================
CREATE OR REPLACE FUNCTION public.booth_workspaces_summary(p_exhibitor_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_items jsonb;
BEGIN
  PERFORM public._booth_require_user();
  IF p_exhibitor_id IS NULL THEN
    RAISE EXCEPTION 'BOOTH_INVALID_INPUT';
  END IF;
  v_role := public.booth_role(p_exhibitor_id);
  IF v_role IS NULL THEN
    RAISE EXCEPTION 'BOOTH_NOT_FOUND';
  END IF;
  IF v_role <> 'manager' THEN
    RAISE EXCEPTION 'BOOTH_FORBIDDEN';
  END IF;
  IF NOT public._booth_is_paid(p_exhibitor_id) THEN
    RAISE EXCEPTION 'BOOTH_PLAN_REQUIRED';
  END IF;

  SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.date_debut DESC NULLS LAST), '[]'::jsonb)
    INTO v_items
  FROM (
    SELECT w.id AS workspace_id, e.nom_event, e.ville, e.date_debut, e.date_fin,
           w.currency, w.total_cost, (w.archived_at IS NOT NULL) AS archived,
           CASE
             WHEN e.date_debut IS NULL THEN 'unknown'
             WHEN (now() AT TIME ZONE w.timezone)::date < e.date_debut THEN 'before'
             WHEN (now() AT TIME ZONE w.timezone)::date <= coalesce(e.date_fin, e.date_debut) THEN 'during'
             ELSE 'after'
           END AS phase,
           coalesce(i.meetings, 0) AS meetings,
           coalesce(i.people, 0) AS people,
           coalesce(i.new_prospects, 0) AS new_prospects,
           coalesce(i.hot, 0) AS hot,
           coalesce(i.customers, 0) AS customers,
           coalesce(i.actions_open, 0) AS actions_open,
           coalesce(i.actions_done, 0) AS actions_done,
           coalesce(i.actions_overdue, 0) AS actions_overdue,
           coalesce(o.projects, 0) AS projects,
           coalesce(o.projects_amount, 0) AS projects_amount,
           coalesce(o.projects_without_amount, 0) AS projects_without_amount,
           coalesce(o.weighted_amount, 0) AS weighted_amount,
           coalesce(o.won, 0) AS won,
           coalesce(o.won_amount, 0) AS won_amount,
           coalesce(o.lost, 0) AS lost
    FROM public.booth_workspaces w
    JOIN public.events e ON e.id = w.event_id
    LEFT JOIN LATERAL (
      SELECT count(*) AS meetings,
             count(DISTINCT ii.contact_id) AS people,
             count(*) FILTER (WHERE ii.relationship = 'new_prospect') AS new_prospects,
             count(*) FILTER (WHERE ii.potential = 'hot') AS hot,
             count(*) FILTER (WHERE ii.relationship = 'customer') AS customers,
             count(*) FILTER (WHERE ii.next_action <> 'none' AND ii.next_action_done_at IS NULL) AS actions_open,
             count(*) FILTER (WHERE ii.next_action <> 'none' AND ii.next_action_done_at IS NOT NULL) AS actions_done,
             count(*) FILTER (WHERE ii.next_action <> 'none' AND ii.next_action_done_at IS NULL
                                AND ii.next_action_due < (now() AT TIME ZONE w.timezone)::date) AS actions_overdue
      FROM public.booth_interactions ii
      WHERE ii.workspace_id = w.id AND ii.status = 'completed'
    ) i ON true
    LEFT JOIN LATERAL (
      SELECT count(*) AS projects,
             sum(oo.amount) AS projects_amount,
             count(*) FILTER (WHERE oo.amount IS NULL) AS projects_without_amount,
             sum(oo.amount * oo.probability / 100.0) FILTER (WHERE oo.status = 'open') AS weighted_amount,
             count(*) FILTER (WHERE oo.status = 'won') AS won,
             sum(oo.won_amount) FILTER (WHERE oo.status = 'won') AS won_amount,
             count(*) FILTER (WHERE oo.status = 'lost') AS lost
      FROM public.booth_opportunities oo
      WHERE oo.workspace_id = w.id AND oo.status <> 'abandoned'
    ) o ON true
    WHERE w.exhibitor_id = p_exhibitor_id
  ) x;

  RETURN jsonb_build_object('items', v_items, 'generated_at', now());
END $$;

-- =========================================================================
-- 3. Export complet d'un salon (une ligne par rencontre, plus la liste des projets)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.booth_export_workspace(p_workspace_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  w public.booth_workspaces%ROWTYPE;
  e public.events%ROWTYPE;
  v_role text;
  v_rows jsonb;
  v_projects jsonb;
BEGIN
  PERFORM public._booth_require_user();
  SELECT * INTO w FROM public.booth_workspaces WHERE id = p_workspace_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'BOOTH_NOT_FOUND';
  END IF;
  v_role := public.booth_role(w.exhibitor_id);
  IF v_role IS NULL THEN
    RAISE EXCEPTION 'BOOTH_NOT_FOUND';
  END IF;
  IF v_role <> 'manager' THEN
    RAISE EXCEPTION 'BOOTH_FORBIDDEN';
  END IF;
  SELECT * INTO e FROM public.events WHERE id = w.event_id;
  IF NOT public._booth_has_full_features(w.exhibitor_id, w.event_id) THEN
    RAISE EXCEPTION 'BOOTH_PLAN_REQUIRED';
  END IF;

  SELECT coalesce(jsonb_agg(r ORDER BY r->>'occurred_at'), '[]'::jsonb)
    INTO v_rows
  FROM (
    SELECT jsonb_build_object(
             'interaction_id', i.id,
             'occurred_at', i.occurred_at,
             'local_date', to_char(i.occurred_at AT TIME ZONE w.timezone, 'YYYY-MM-DD'),
             'local_time', to_char(i.occurred_at AT TIME ZONE w.timezone, 'HH24:MI'),
             'day_number', CASE WHEN e.date_debut IS NOT NULL
                                THEN ((i.occurred_at AT TIME ZONE w.timezone)::date - e.date_debut) + 1 END,
             'status', i.status,
             'company_name', c.company_name,
             'first_name', c.first_name,
             'last_name', c.last_name,
             'job_title', c.job_title,
             'email', c.email,
             'phone', c.phone,
             'linkedin_url', c.linkedin_url,
             'contact_source', c.source,
             'relationship', i.relationship,
             'customer_topic', i.customer_topic,
             'potential', i.potential,
             'next_action', i.next_action,
             'next_action_due', i.next_action_due,
             'next_action_done_at', i.next_action_done_at,
             'next_action_owner', public._booth_user_label(i.next_action_owner_id),
             'owner', public._booth_user_label(i.owner_user_id),
             'note', i.note,
             'capture_source', i.capture_source,
             'project_title', op.title,
             'project_value_band', op.value_band,
             'project_amount', op.amount,
             'project_horizon', op.horizon,
             'project_probability', op.probability,
             'project_status', op.status,
             'project_won_amount', op.won_amount
           ) AS r
    FROM public.booth_interactions i
    JOIN public.booth_contacts c ON c.id = i.contact_id
    LEFT JOIN LATERAL (
      SELECT o.* FROM public.booth_opportunities o
      WHERE o.origin_interaction_id = i.id AND o.status <> 'abandoned'
      ORDER BY o.created_at
      LIMIT 1
    ) op ON true
    WHERE i.workspace_id = w.id
  ) s;

  SELECT coalesce(jsonb_agg(p ORDER BY p->>'created_at'), '[]'::jsonb)
    INTO v_projects
  FROM (
    SELECT jsonb_build_object(
             'opportunity_id', o.id,
             'created_at', o.created_at,
             'title', o.title,
             'company_name', c.company_name,
             'first_name', c.first_name,
             'last_name', c.last_name,
             'value_band', o.value_band,
             'amount', o.amount,
             'currency', o.currency,
             'horizon', o.horizon,
             'probability', o.probability,
             'status', o.status,
             'won_amount', o.won_amount,
             'won_at', o.won_at,
             'lost_at', o.lost_at,
             'owner', public._booth_user_label(o.owner_user_id)
           ) AS p
    FROM public.booth_opportunities o
    JOIN public.booth_contacts c ON c.id = o.contact_id
    WHERE o.workspace_id = w.id
  ) s;

  RETURN jsonb_build_object(
    'workspace', jsonb_build_object(
      'workspace_id', w.id, 'nom_event', e.nom_event, 'ville', e.ville,
      'date_debut', e.date_debut, 'date_fin', e.date_fin, 'stand_label', w.stand_label,
      'timezone', w.timezone, 'currency', w.currency, 'total_cost', w.total_cost),
    'rows', v_rows,
    'projects', v_projects,
    'generated_at', now());
END $$;

-- =========================================================================
-- 4. Droits d'exécution
-- =========================================================================
REVOKE ALL ON FUNCTION public.booth_workspaces_summary(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.booth_workspaces_summary(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.booth_export_workspace(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.booth_export_workspace(uuid) TO authenticated;
