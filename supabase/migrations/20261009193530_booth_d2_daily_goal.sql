-- Lotexpo Leads, Lot D2 (serveur) : objectif de rencontres du jour, fixé par le manager.
-- Additif : 1 colonne nullable, 1 fonction nouvelle ; booth_bootstrap renvoie en plus 'daily_goal' dans 'workspace'
-- (corps identique à la version en place, une seule ligne ajoutée).
-- daily_goal = nombre de rencontres visé par l'équipe pour chaque journée du salon (null = pas d'objectif).

-- =========================================================================
-- 1. Colonne
-- =========================================================================
ALTER TABLE public.booth_workspaces
  ADD COLUMN daily_goal integer CHECK (daily_goal BETWEEN 1 AND 500);

COMMENT ON COLUMN public.booth_workspaces.daily_goal IS
  'Lotexpo Leads : objectif de rencontres de l''équipe par journée de salon (null = aucun). Fixé par un manager.';

-- =========================================================================
-- 2. Réglage par un manager (null efface l'objectif)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.booth_set_daily_goal(p_workspace_id uuid, p_goal integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ws public.booth_workspaces%ROWTYPE;
BEGIN
  PERFORM public._booth_require_user();
  SELECT * INTO v_ws FROM public.booth_workspaces WHERE id = p_workspace_id FOR UPDATE;
  IF NOT FOUND OR public.booth_role(v_ws.exhibitor_id) IS DISTINCT FROM 'manager' THEN
    -- Même réponse qu'un identifiant inconnu : aucune fuite
    RAISE EXCEPTION 'BOOTH_NOT_FOUND';
  END IF;
  IF v_ws.archived_at IS NOT NULL THEN
    RAISE EXCEPTION 'BOOTH_WORKSPACE_ARCHIVED';
  END IF;
  IF p_goal IS NOT NULL AND (p_goal < 1 OR p_goal > 500) THEN
    RAISE EXCEPTION 'BOOTH_INVALID_INPUT';
  END IF;

  UPDATE public.booth_workspaces SET daily_goal = p_goal WHERE id = v_ws.id;

  RETURN jsonb_build_object('workspace_id', v_ws.id, 'daily_goal', p_goal);
END $$;

REVOKE ALL ON FUNCTION public.booth_set_daily_goal(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.booth_set_daily_goal(uuid, integer) TO authenticated;

-- =========================================================================
-- 3. booth_bootstrap : ajoute 'daily_goal' dans l'objet workspace
-- =========================================================================
CREATE OR REPLACE FUNCTION public.booth_bootstrap(p_workspace_id uuid, p_since timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := public._booth_require_user();
  w public.booth_workspaces%ROWTYPE;
  v_role text;
  v_workspace jsonb;
  v_team jsonb;
  v_contacts jsonb;
  v_contacts_total bigint;
  v_inter jsonb;
  v_opps jsonb;
  v_leads jsonb;
  c_max constant int := 5000;
BEGIN
  SELECT * INTO w FROM public.booth_workspaces WHERE id = p_workspace_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'BOOTH_NOT_FOUND';
  END IF;
  v_role := public.booth_role(w.exhibitor_id);
  IF v_role IS NULL THEN
    RAISE EXCEPTION 'BOOTH_NOT_FOUND';
  END IF;

  SELECT jsonb_build_object(
           'workspace_id', w.id, 'exhibitor_id', w.exhibitor_id, 'event_id', w.event_id,
           'nom_event', e.nom_event, 'event_slug', e.slug, 'ville', e.ville,
           'date_debut', e.date_debut, 'date_fin', e.date_fin,
           'stand_label', w.stand_label, 'timezone', w.timezone, 'currency', w.currency,
           'total_cost', CASE WHEN v_role = 'manager' THEN w.total_cost END,
           'daily_goal', w.daily_goal,
           'archived', w.archived_at IS NOT NULL,
           'phase', CASE
             WHEN e.date_debut IS NULL THEN 'unknown'
             WHEN (now() AT TIME ZONE w.timezone)::date < e.date_debut THEN 'before'
             WHEN (now() AT TIME ZONE w.timezone)::date <= coalesce(e.date_fin, e.date_debut) THEN 'during'
             ELSE 'after' END)
    INTO v_workspace
  FROM public.events e WHERE e.id = w.event_id;

  -- Équipe : owner/admin de la fiche (managers) et membres invités actifs
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'user_id', t.user_id, 'role', t.role,
           'name', nullif(btrim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')), ''),
           'email', CASE WHEN v_role = 'manager' THEN u.email END) ORDER BY t.role, p.last_name NULLS LAST), '[]'::jsonb)
    INTO v_team
  FROM (
    SELECT DISTINCT ON (x.user_id) x.user_id, x.role FROM (
      SELECT etm.user_id, 'manager' AS role, 1 AS prio FROM public.exhibitor_team_members etm
       WHERE etm.exhibitor_id = w.exhibitor_id AND etm.status = 'active' AND etm.role IN ('owner', 'admin')
      UNION ALL
      SELECT m.user_id, m.role, CASE m.role WHEN 'manager' THEN 1 ELSE 2 END FROM public.booth_team_members m
       WHERE m.exhibitor_id = w.exhibitor_id AND m.status = 'active' AND m.user_id IS NOT NULL
    ) x ORDER BY x.user_id, x.prio
  ) t
  LEFT JOIN public.profiles p ON p.user_id = t.user_id
  LEFT JOIN auth.users u ON u.id = t.user_id;

  -- Contacts de l'exposant (partagés entre tous les salons)
  SELECT count(*) INTO v_contacts_total
  FROM public.booth_contacts c
  WHERE c.exhibitor_id = w.exhibitor_id
    AND CASE WHEN p_since IS NULL THEN c.archived_at IS NULL AND c.merged_into_id IS NULL ELSE c.updated_at > p_since END;

  SELECT coalesce(jsonb_agg(to_jsonb(c) - 'email_norm' ORDER BY c.updated_at DESC), '[]'::jsonb)
    INTO v_contacts
  FROM (
    SELECT * FROM public.booth_contacts c
    WHERE c.exhibitor_id = w.exhibitor_id
      AND CASE WHEN p_since IS NULL THEN c.archived_at IS NULL AND c.merged_into_id IS NULL ELSE c.updated_at > p_since END
    ORDER BY c.updated_at DESC
    LIMIT c_max
  ) c;

  SELECT coalesce(jsonb_agg(to_jsonb(i) ORDER BY i.occurred_at DESC), '[]'::jsonb)
    INTO v_inter
  FROM public.booth_interactions i
  WHERE i.workspace_id = w.id AND (p_since IS NULL OR i.updated_at > p_since);

  SELECT coalesce(jsonb_agg(to_jsonb(o) ORDER BY o.created_at DESC), '[]'::jsonb)
    INTO v_opps
  FROM public.booth_opportunities o
  WHERE o.workspace_id = w.id AND (p_since IS NULL OR o.updated_at > p_since);

  -- Demandes reçues via Lotexpo pour ce salon (à rattacher aux rencontres)
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'lead_id', l.id, 'type', coalesce(l.lead_type, l.type), 'created_at', l.created_at,
           'name', coalesce(nullif(btrim(l.lead_name), ''), nullif(btrim(coalesce(l.first_name, '') || ' ' || coalesce(l.last_name, '')), '')),
           'email', coalesce(l.lead_email, l.email), 'company', coalesce(l.lead_company, l.company),
           'job_title', coalesce(l.lead_position, l.role), 'phone', coalesce(l.lead_phone, l.phone),
           'rdv_date', l.rdv_date, 'preferred_slot', l.preferred_slot, 'status', l.status)
           ORDER BY l.created_at DESC), '[]'::jsonb)
    INTO v_leads
  FROM public.leads l
  WHERE l.exhibitor_id = w.exhibitor_id AND l.event_id = w.event_id;

  RETURN jsonb_build_object(
    'server_time', now(),
    -- Marge de 2 minutes : à repasser tel quel en p_since au prochain appel
    'next_since', now() - interval '2 minutes',
    'role', v_role,
    'me', v_uid,
    'full_features', public._booth_has_full_features(w.exhibitor_id, w.event_id),
    'workspace', v_workspace,
    'team', v_team,
    'contacts', jsonb_build_object('total', v_contacts_total, 'truncated', v_contacts_total > c_max, 'items', v_contacts),
    'interactions', v_inter,
    'opportunities', v_opps,
    'inbound_leads', v_leads
  );
END $function$;
