-- Lotexpo Leads, Lot 3a : accès bêta, formules, espaces salon, équipe et invitations (fonctions serveur).
-- Purement additif : colonnes ajoutées aux tables booth_, nouvelles fonctions, booth_role() remplacée.
-- Codes d'erreur stables renvoyés au site : BOOTH_DISABLED, BOOTH_AUTH_REQUIRED, BOOTH_FORBIDDEN,
-- BOOTH_NOT_FOUND, BOOTH_INVALID_INPUT, BOOTH_PLAN_REQUIRED, BOOTH_SEATS_FULL, BOOTH_ALREADY_MEMBER,
-- BOOTH_INVITE_INVALID, BOOTH_INVITE_EXPIRED, BOOTH_EMAIL_MISMATCH, BOOTH_ACCESS_NOT_APPROVED.

-- =========================================================================
-- 1. Colonnes
-- =========================================================================
ALTER TABLE public.booth_access
  ADD COLUMN plan text NOT NULL DEFAULT 'free' CHECK (plan IN ('free','beta','pass','annual')),
  ADD COLUMN plan_event_id uuid REFERENCES public.events(id) ON DELETE SET NULL,
  ADD COLUMN plan_valid_until timestamptz,
  ADD COLUMN admin_notified_at timestamptz,
  ADD COLUMN decision_notified_at timestamptz;

CREATE INDEX booth_access_plan_event_idx ON public.booth_access (plan_event_id);
CREATE INDEX booth_access_status_idx ON public.booth_access (status, created_at DESC);

ALTER TABLE public.booth_team_members
  ADD COLUMN accepted_at timestamptz;

COMMENT ON COLUMN public.booth_access.plan IS
  'free : comptes owner/admin de la fiche uniquement, sans IA. beta : tout inclus, offert. pass : tout inclus pour plan_event_id. annual : tout inclus jusqu''à plan_valid_until.';

-- =========================================================================
-- 2. Fonctions internes (non appelables depuis le site)
-- =========================================================================
CREATE OR REPLACE FUNCTION public._booth_require_user()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.booth_enabled() THEN
    RAISE EXCEPTION 'BOOTH_DISABLED';
  END IF;
  IF NOT public.booth_is_real_user() THEN
    RAISE EXCEPTION 'BOOTH_AUTH_REQUIRED';
  END IF;
  RETURN auth.uid();
END $$;

-- Formule payante (ou bêta) en cours de validité, tous salons confondus
CREATE OR REPLACE FUNCTION public._booth_is_paid(p_exhibitor_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.booth_access a
    WHERE a.exhibitor_id = p_exhibitor_id
      AND a.status = 'approved'
      AND (
        a.plan = 'beta'
        OR (a.plan IN ('annual','pass') AND (a.plan_valid_until IS NULL OR a.plan_valid_until > now()))
      )
  )
$$;

-- Fonctions complètes (vocal, IA, tableau de bord) disponibles pour un salon donné
CREATE OR REPLACE FUNCTION public._booth_has_full_features(p_exhibitor_id uuid, p_event_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.booth_access a
    WHERE a.exhibitor_id = p_exhibitor_id
      AND a.status = 'approved'
      AND (
        a.plan = 'beta'
        OR (a.plan = 'annual' AND (a.plan_valid_until IS NULL OR a.plan_valid_until > now()))
        OR (a.plan = 'pass' AND a.plan_event_id = p_event_id
            AND (a.plan_valid_until IS NULL OR a.plan_valid_until > now()))
      )
  )
$$;

CREATE OR REPLACE FUNCTION public._booth_is_fiche_manager(p_exhibitor_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.exhibitor_team_members t
    WHERE t.exhibitor_id = p_exhibitor_id AND t.user_id = p_user_id
      AND t.status = 'active' AND t.role IN ('owner','admin')
  )
$$;

-- =========================================================================
-- 3. booth_role() : les membres invités n'ont accès qu'avec une formule payante ou bêta
-- =========================================================================
CREATE OR REPLACE FUNCTION public.booth_role(_exhibitor_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid  uuid := auth.uid();
  _role text;
BEGIN
  IF _exhibitor_id IS NULL OR NOT public.booth_enabled() OR NOT public.booth_is_real_user() THEN
    RETURN NULL;
  END IF;
  -- Admin Lotexpo : manager partout (support), même sans accès bêta validé
  IF public.has_role(_uid, 'admin'::app_role) THEN
    RETURN 'manager';
  END IF;
  -- Accès validé obligatoire pour tous les autres
  IF NOT EXISTS (SELECT 1 FROM public.booth_access a
                 WHERE a.exhibitor_id = _exhibitor_id AND a.status = 'approved') THEN
    RETURN NULL;
  END IF;
  -- Owner ou admin actif de la fiche : manager, quelle que soit la formule
  IF public._booth_is_fiche_manager(_exhibitor_id, _uid) THEN
    RETURN 'manager';
  END IF;
  -- Membres invités : formule payante ou bêta en cours de validité
  IF NOT public._booth_is_paid(_exhibitor_id) THEN
    RETURN NULL;
  END IF;
  SELECT m.role INTO _role
  FROM public.booth_team_members m
  WHERE m.exhibitor_id = _exhibitor_id AND m.user_id = _uid AND m.status = 'active';
  RETURN _role;
END $$;

-- =========================================================================
-- 4. Accès bêta : demande (owner/admin de la fiche) et lecture
-- =========================================================================
CREATE OR REPLACE FUNCTION public.booth_request_access(
  p_exhibitor_id uuid,
  p_target_event_id uuid DEFAULT NULL,
  p_team_size integer DEFAULT NULL,
  p_message text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := public._booth_require_user();
  v_row public.booth_access%ROWTYPE;
  v_msg text := nullif(btrim(coalesce(p_message,'')), '');
BEGIN
  IF p_exhibitor_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.exhibitors WHERE id = p_exhibitor_id) THEN
    RAISE EXCEPTION 'BOOTH_NOT_FOUND';
  END IF;
  IF NOT public._booth_is_fiche_manager(p_exhibitor_id, v_uid) AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'BOOTH_FORBIDDEN';
  END IF;
  IF p_team_size IS NOT NULL AND (p_team_size < 1 OR p_team_size > 1000) THEN
    RAISE EXCEPTION 'BOOTH_INVALID_INPUT';
  END IF;
  IF v_msg IS NOT NULL AND length(v_msg) > 2000 THEN
    RAISE EXCEPTION 'BOOTH_INVALID_INPUT';
  END IF;
  IF p_target_event_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.events WHERE id = p_target_event_id) THEN
    RAISE EXCEPTION 'BOOTH_INVALID_INPUT';
  END IF;

  SELECT * INTO v_row FROM public.booth_access WHERE exhibitor_id = p_exhibitor_id FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.booth_access (exhibitor_id, status, requested_by, target_event_id, team_size, message)
    VALUES (p_exhibitor_id, 'requested', v_uid, p_target_event_id, p_team_size, v_msg)
    RETURNING * INTO v_row;
  ELSIF v_row.status = 'approved' THEN
    RETURN jsonb_build_object('status', 'approved', 'changed', false);
  ELSIF v_row.status = 'requested' THEN
    UPDATE public.booth_access
       SET target_event_id = p_target_event_id, team_size = p_team_size, message = v_msg
     WHERE id = v_row.id
     RETURNING * INTO v_row;
  ELSE
    -- rejected ou revoked : nouvelle demande
    UPDATE public.booth_access
       SET status = 'requested', requested_by = v_uid, target_event_id = p_target_event_id,
           team_size = p_team_size, message = v_msg, reviewed_by = NULL, reviewed_at = NULL,
           admin_note = NULL, admin_notified_at = NULL, decision_notified_at = NULL,
           created_at = now()
     WHERE id = v_row.id
     RETURNING * INTO v_row;
  END IF;

  RETURN jsonb_build_object('status', v_row.status, 'changed', true, 'access_id', v_row.id);
END $$;

CREATE OR REPLACE FUNCTION public.booth_get_access(p_exhibitor_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := public._booth_require_user();
  v_row public.booth_access%ROWTYPE;
BEGIN
  IF NOT public._booth_is_fiche_manager(p_exhibitor_id, v_uid)
     AND NOT public.is_admin()
     AND NOT EXISTS (SELECT 1 FROM public.booth_team_members m
                     WHERE m.exhibitor_id = p_exhibitor_id AND m.user_id = v_uid AND m.status = 'active') THEN
    RAISE EXCEPTION 'BOOTH_FORBIDDEN';
  END IF;

  SELECT * INTO v_row FROM public.booth_access WHERE exhibitor_id = p_exhibitor_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'none', 'plan', null, 'is_paid', false);
  END IF;

  RETURN jsonb_build_object(
    'status', v_row.status,
    'plan', v_row.plan,
    'plan_event_id', v_row.plan_event_id,
    'plan_valid_until', v_row.plan_valid_until,
    'is_paid', public._booth_is_paid(p_exhibitor_id),
    'target_event_id', v_row.target_event_id,
    'team_size', v_row.team_size,
    'requested_at', v_row.created_at,
    'reviewed_at', v_row.reviewed_at
  );
END $$;

-- =========================================================================
-- 5. Accès bêta : administration Lotexpo
-- =========================================================================
CREATE OR REPLACE FUNCTION public.booth_admin_list_access(p_status text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_items jsonb;
  v_total integer;
BEGIN
  PERFORM public._booth_require_user();
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'BOOTH_FORBIDDEN';
  END IF;

  SELECT count(*) INTO v_total
  FROM public.booth_access a WHERE p_status IS NULL OR a.status = p_status;

  SELECT coalesce(jsonb_agg(row_to_json(x) ORDER BY x.status_rank, x.created_at DESC), '[]'::jsonb)
    INTO v_items
  FROM (
    SELECT a.id, a.exhibitor_id, x.name AS exhibitor_name, x.slug AS exhibitor_slug,
           a.status, a.plan, a.plan_event_id, pe.nom_event AS plan_event_name, a.plan_valid_until,
           a.requested_by, u.email AS requested_by_email,
           a.target_event_id, te.nom_event AS target_event_name, te.date_debut AS target_event_start,
           a.team_size, a.message, a.admin_note, a.reviewed_at, a.created_at,
           CASE a.status WHEN 'requested' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END AS status_rank
    FROM public.booth_access a
    JOIN public.exhibitors x ON x.id = a.exhibitor_id
    LEFT JOIN auth.users u ON u.id = a.requested_by
    LEFT JOIN public.events te ON te.id = a.target_event_id
    LEFT JOIN public.events pe ON pe.id = a.plan_event_id
    WHERE p_status IS NULL OR a.status = p_status
  ) x;

  RETURN jsonb_build_object('total', v_total, 'items', v_items);
END $$;

CREATE OR REPLACE FUNCTION public.booth_admin_review_access(
  p_exhibitor_id uuid,
  p_decision text,
  p_note text DEFAULT NULL,
  p_plan text DEFAULT 'beta',
  p_plan_event_id uuid DEFAULT NULL,
  p_plan_valid_until timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := public._booth_require_user();
  v_row public.booth_access%ROWTYPE;
  v_new_status text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'BOOTH_FORBIDDEN';
  END IF;
  IF p_decision NOT IN ('approve','reject','revoke','set_plan') THEN
    RAISE EXCEPTION 'BOOTH_INVALID_INPUT';
  END IF;
  IF p_plan NOT IN ('free','beta','pass','annual') THEN
    RAISE EXCEPTION 'BOOTH_INVALID_INPUT';
  END IF;
  IF p_plan = 'pass' AND p_plan_event_id IS NULL THEN
    RAISE EXCEPTION 'BOOTH_INVALID_INPUT';
  END IF;

  SELECT * INTO v_row FROM public.booth_access WHERE exhibitor_id = p_exhibitor_id FOR UPDATE;
  IF NOT FOUND THEN
    -- L'admin peut ouvrir l'accès sans demande préalable (exposant accompagné)
    IF p_decision NOT IN ('approve','set_plan') THEN
      RAISE EXCEPTION 'BOOTH_NOT_FOUND';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.exhibitors WHERE id = p_exhibitor_id) THEN
      RAISE EXCEPTION 'BOOTH_NOT_FOUND';
    END IF;
    INSERT INTO public.booth_access (exhibitor_id, status, requested_by, admin_notified_at)
    VALUES (p_exhibitor_id, 'requested', NULL, now())
    RETURNING * INTO v_row;
  END IF;

  v_new_status := CASE p_decision
                    WHEN 'approve' THEN 'approved'
                    WHEN 'reject'  THEN 'rejected'
                    WHEN 'revoke'  THEN 'revoked'
                    ELSE v_row.status
                  END;

  IF p_decision = 'set_plan' AND v_row.status <> 'approved' THEN
    RAISE EXCEPTION 'BOOTH_ACCESS_NOT_APPROVED';
  END IF;

  UPDATE public.booth_access
     SET status = v_new_status,
         plan = CASE WHEN p_decision IN ('approve','set_plan') THEN p_plan ELSE plan END,
         plan_event_id = CASE WHEN p_decision IN ('approve','set_plan') THEN p_plan_event_id ELSE plan_event_id END,
         plan_valid_until = CASE WHEN p_decision IN ('approve','set_plan') THEN p_plan_valid_until ELSE plan_valid_until END,
         admin_note = coalesce(nullif(btrim(coalesce(p_note,'')), ''), admin_note),
         reviewed_by = v_uid,
         reviewed_at = now(),
         decision_notified_at = CASE WHEN v_new_status <> v_row.status THEN NULL ELSE decision_notified_at END
   WHERE id = v_row.id
   RETURNING * INTO v_row;

  RETURN jsonb_build_object('status', v_row.status, 'plan', v_row.plan, 'access_id', v_row.id);
END $$;

-- =========================================================================
-- 6. Espaces salon
-- =========================================================================
CREATE OR REPLACE FUNCTION public.booth_create_workspace(
  p_exhibitor_id uuid,
  p_event_id uuid,
  p_stand_label text DEFAULT NULL,
  p_timezone text DEFAULT 'Europe/Paris'
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := public._booth_require_user();
  v_ws public.booth_workspaces%ROWTYPE;
  v_known boolean;
  v_created boolean := false;
  v_stand text := nullif(btrim(coalesce(p_stand_label,'')), '');
BEGIN
  IF public.booth_role(p_exhibitor_id) IS DISTINCT FROM 'manager' THEN
    RAISE EXCEPTION 'BOOTH_FORBIDDEN';
  END IF;
  IF p_event_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.events WHERE id = p_event_id) THEN
    RAISE EXCEPTION 'BOOTH_NOT_FOUND';
  END IF;
  IF v_stand IS NOT NULL AND length(v_stand) > 100 THEN
    RAISE EXCEPTION 'BOOTH_INVALID_INPUT';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = coalesce(p_timezone,'')) THEN
    RAISE EXCEPTION 'BOOTH_INVALID_INPUT';
  END IF;

  SELECT * INTO v_ws FROM public.booth_workspaces
   WHERE exhibitor_id = p_exhibitor_id AND event_id = p_event_id FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.booth_workspaces (exhibitor_id, event_id, stand_label, timezone, created_by)
    VALUES (p_exhibitor_id, p_event_id, v_stand, p_timezone, v_uid)
    RETURNING * INTO v_ws;
    v_created := true;
  ELSIF v_ws.archived_at IS NOT NULL THEN
    UPDATE public.booth_workspaces SET archived_at = NULL WHERE id = v_ws.id RETURNING * INTO v_ws;
  END IF;

  -- Contrôle souple de participation (moderne ou legacy)
  SELECT EXISTS (
    SELECT 1 FROM public.participation p
    WHERE p.id_event = p_event_id
      AND (p.exhibitor_id = p_exhibitor_id
           OR p.id_exposant IN (SELECT epi.legacy_exposant_id FROM public.exhibitor_public_identities epi
                                WHERE epi.exhibitor_id = p_exhibitor_id AND epi.legacy_exposant_id IS NOT NULL))
  ) INTO v_known;

  RETURN jsonb_build_object('workspace_id', v_ws.id, 'created', v_created, 'participation_known', v_known);
END $$;

CREATE OR REPLACE FUNCTION public.booth_update_workspace(
  p_workspace_id uuid,
  p_stand_label text DEFAULT NULL,
  p_total_cost numeric DEFAULT NULL,
  p_timezone text DEFAULT NULL,
  p_archived boolean DEFAULT NULL,
  p_clear_cost boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
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
  IF p_total_cost IS NOT NULL AND (p_total_cost < 0 OR p_total_cost > 9999999999) THEN
    RAISE EXCEPTION 'BOOTH_INVALID_INPUT';
  END IF;
  IF p_stand_label IS NOT NULL AND length(btrim(p_stand_label)) > 100 THEN
    RAISE EXCEPTION 'BOOTH_INVALID_INPUT';
  END IF;
  IF p_timezone IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = p_timezone) THEN
    RAISE EXCEPTION 'BOOTH_INVALID_INPUT';
  END IF;

  UPDATE public.booth_workspaces
     SET stand_label = CASE WHEN p_stand_label IS NULL THEN stand_label ELSE nullif(btrim(p_stand_label), '') END,
         total_cost  = CASE WHEN p_clear_cost THEN NULL WHEN p_total_cost IS NULL THEN total_cost ELSE p_total_cost END,
         timezone    = coalesce(p_timezone, timezone),
         archived_at = CASE WHEN p_archived IS NULL THEN archived_at WHEN p_archived THEN coalesce(archived_at, now()) ELSE NULL END
   WHERE id = v_ws.id
   RETURNING * INTO v_ws;

  RETURN jsonb_build_object('workspace_id', v_ws.id, 'archived', v_ws.archived_at IS NOT NULL);
END $$;

CREATE OR REPLACE FUNCTION public.booth_list_workspaces(p_exhibitor_id uuid)
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
  v_role := public.booth_role(p_exhibitor_id);
  IF v_role IS NULL THEN
    RAISE EXCEPTION 'BOOTH_FORBIDDEN';
  END IF;

  SELECT coalesce(jsonb_agg(row_to_json(x) ORDER BY x.date_debut DESC NULLS LAST), '[]'::jsonb)
    INTO v_items
  FROM (
    SELECT w.id AS workspace_id, w.event_id, e.nom_event, e.slug AS event_slug, e.ville,
           e.date_debut, e.date_fin, w.stand_label, w.timezone, w.currency,
           CASE WHEN v_role = 'manager' THEN w.total_cost END AS total_cost,
           (w.archived_at IS NOT NULL) AS archived,
           CASE
             WHEN e.date_debut IS NULL THEN 'unknown'
             WHEN (now() AT TIME ZONE w.timezone)::date < e.date_debut THEN 'before'
             WHEN (now() AT TIME ZONE w.timezone)::date <= coalesce(e.date_fin, e.date_debut) THEN 'during'
             ELSE 'after'
           END AS phase,
           public._booth_has_full_features(w.exhibitor_id, w.event_id) AS full_features,
           (SELECT count(*) FROM public.booth_interactions i WHERE i.workspace_id = w.id AND i.status = 'completed') AS interactions_count
    FROM public.booth_workspaces w
    JOIN public.events e ON e.id = w.event_id
    WHERE w.exhibitor_id = p_exhibitor_id
  ) x;

  RETURN jsonb_build_object('role', v_role, 'items', v_items);
END $$;

-- =========================================================================
-- 7. Équipe : invitations, acceptation, révocation, liste
-- =========================================================================
CREATE OR REPLACE FUNCTION public.booth_invite_member(
  p_exhibitor_id uuid,
  p_email text,
  p_role text DEFAULT 'field'
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := public._booth_require_user();
  v_email text := lower(btrim(coalesce(p_email,'')));
  v_token text;
  v_hash text;
  v_expires timestamptz := now() + interval '14 days';
  v_seats integer;
  v_member public.booth_team_members%ROWTYPE;
  v_existing_user uuid;
BEGIN
  IF public.booth_role(p_exhibitor_id) IS DISTINCT FROM 'manager' THEN
    RAISE EXCEPTION 'BOOTH_FORBIDDEN';
  END IF;
  IF NOT public._booth_is_paid(p_exhibitor_id) THEN
    RAISE EXCEPTION 'BOOTH_PLAN_REQUIRED';
  END IF;
  IF p_role NOT IN ('manager','field') THEN
    RAISE EXCEPTION 'BOOTH_INVALID_INPUT';
  END IF;
  IF v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' OR length(v_email) > 254 THEN
    RAISE EXCEPTION 'BOOTH_INVALID_INPUT';
  END IF;

  -- Déjà membre actif (par compte existant) ou owner/admin de la fiche ?
  SELECT u.id INTO v_existing_user FROM auth.users u WHERE lower(u.email) = v_email LIMIT 1;
  IF v_existing_user IS NOT NULL AND (
       public._booth_is_fiche_manager(p_exhibitor_id, v_existing_user)
       OR EXISTS (SELECT 1 FROM public.booth_team_members m
                  WHERE m.exhibitor_id = p_exhibitor_id AND m.user_id = v_existing_user AND m.status = 'active')) THEN
    RAISE EXCEPTION 'BOOTH_ALREADY_MEMBER';
  END IF;

  -- Limite raisonnable : 15 comptes (actifs + invitations en cours)
  SELECT count(*) INTO v_seats FROM public.booth_team_members m
   WHERE m.exhibitor_id = p_exhibitor_id
     AND (m.status = 'active' OR (m.status = 'invited' AND m.invite_expires_at > now()))
     AND m.invited_email IS DISTINCT FROM v_email;
  IF v_seats >= 15 THEN
    RAISE EXCEPTION 'BOOTH_SEATS_FULL';
  END IF;

  v_token := encode(extensions.gen_random_bytes(24), 'hex');
  v_hash  := encode(extensions.digest(v_token, 'sha256'), 'hex');

  SELECT * INTO v_member FROM public.booth_team_members m
   WHERE m.exhibitor_id = p_exhibitor_id AND m.status = 'invited' AND m.invited_email = v_email
   FOR UPDATE;

  IF FOUND THEN
    UPDATE public.booth_team_members
       SET invite_token_hash = v_hash, invite_expires_at = v_expires, role = p_role, invited_by = v_uid
     WHERE id = v_member.id
     RETURNING * INTO v_member;
  ELSE
    INSERT INTO public.booth_team_members (exhibitor_id, invited_email, invite_token_hash, invite_expires_at, role, status, invited_by)
    VALUES (p_exhibitor_id, v_email, v_hash, v_expires, p_role, 'invited', v_uid)
    RETURNING * INTO v_member;
  END IF;

  RETURN jsonb_build_object(
    'member_id', v_member.id,
    'token', v_token,
    'expires_at', v_member.invite_expires_at,
    'email', v_email,
    'role', v_member.role
  );
END $$;

CREATE OR REPLACE FUNCTION public.booth_accept_invite(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := public._booth_require_user();
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_hash text;
  v_inv public.booth_team_members%ROWTYPE;
  v_prev public.booth_team_members%ROWTYPE;
  v_name text;
BEGIN
  IF p_token IS NULL OR p_token !~ '^[0-9a-f]{48}$' THEN
    RAISE EXCEPTION 'BOOTH_INVITE_INVALID';
  END IF;
  v_hash := encode(extensions.digest(p_token, 'sha256'), 'hex');

  SELECT * INTO v_inv FROM public.booth_team_members WHERE invite_token_hash = v_hash FOR UPDATE;
  IF NOT FOUND OR v_inv.status <> 'invited' THEN
    RAISE EXCEPTION 'BOOTH_INVITE_INVALID';
  END IF;
  IF v_inv.invite_expires_at IS NULL OR v_inv.invite_expires_at <= now() THEN
    RAISE EXCEPTION 'BOOTH_INVITE_EXPIRED';
  END IF;
  IF v_email = '' OR v_email <> v_inv.invited_email THEN
    RAISE EXCEPTION 'BOOTH_EMAIL_MISMATCH';
  END IF;

  SELECT name INTO v_name FROM public.exhibitors WHERE id = v_inv.exhibitor_id;

  -- Une ligne existe déjà pour ce compte (révoqué puis réinvité) : on la réactive
  SELECT * INTO v_prev FROM public.booth_team_members
   WHERE exhibitor_id = v_inv.exhibitor_id AND user_id = v_uid FOR UPDATE;

  IF FOUND THEN
    UPDATE public.booth_team_members
       SET status = 'active', role = v_inv.role, revoked_at = NULL, accepted_at = now(),
           invited_by = v_inv.invited_by
     WHERE id = v_prev.id;
    UPDATE public.booth_team_members
       SET status = 'revoked', revoked_at = now(), invite_token_hash = NULL
     WHERE id = v_inv.id;
  ELSE
    UPDATE public.booth_team_members
       SET status = 'active', user_id = v_uid, accepted_at = now(), invite_token_hash = NULL
     WHERE id = v_inv.id;
  END IF;

  RETURN jsonb_build_object('exhibitor_id', v_inv.exhibitor_id, 'exhibitor_name', v_name, 'role', v_inv.role);
END $$;

CREATE OR REPLACE FUNCTION public.booth_revoke_member(p_member_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_m public.booth_team_members%ROWTYPE;
BEGIN
  PERFORM public._booth_require_user();
  SELECT * INTO v_m FROM public.booth_team_members WHERE id = p_member_id FOR UPDATE;
  IF NOT FOUND OR public.booth_role(v_m.exhibitor_id) IS DISTINCT FROM 'manager' THEN
    RAISE EXCEPTION 'BOOTH_NOT_FOUND';
  END IF;
  IF v_m.status = 'revoked' THEN
    RETURN jsonb_build_object('member_id', v_m.id, 'status', 'revoked', 'changed', false);
  END IF;
  UPDATE public.booth_team_members
     SET status = 'revoked', revoked_at = now(), invite_token_hash = NULL
   WHERE id = v_m.id;
  RETURN jsonb_build_object('member_id', v_m.id, 'status', 'revoked', 'changed', true);
END $$;

CREATE OR REPLACE FUNCTION public.booth_list_members(p_exhibitor_id uuid)
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
  v_role := public.booth_role(p_exhibitor_id);
  IF v_role IS NULL THEN
    RAISE EXCEPTION 'BOOTH_FORBIDDEN';
  END IF;

  SELECT coalesce(jsonb_agg(row_to_json(x) ORDER BY x.sort_rank, x.display_name), '[]'::jsonb)
    INTO v_items
  FROM (
    -- Owners et admins de la fiche (managers hérités, non révocables ici)
    SELECT NULL::uuid AS member_id, t.user_id, 'manager'::text AS role, 'active'::text AS status,
           true AS inherited,
           coalesce(nullif(btrim(coalesce(p.first_name,'') || ' ' || coalesce(p.last_name,'')), ''), 'Membre') AS display_name,
           CASE WHEN v_role = 'manager' THEN u.email END AS email,
           NULL::timestamptz AS invite_expires_at,
           0 AS sort_rank
    FROM public.exhibitor_team_members t
    LEFT JOIN public.profiles p ON p.user_id = t.user_id
    LEFT JOIN auth.users u ON u.id = t.user_id
    WHERE t.exhibitor_id = p_exhibitor_id AND t.status = 'active' AND t.role IN ('owner','admin')
    UNION ALL
    SELECT m.id, m.user_id, m.role, m.status, false,
           coalesce(nullif(btrim(coalesce(p.first_name,'') || ' ' || coalesce(p.last_name,'')), ''),
                    CASE WHEN v_role = 'manager' THEN m.invited_email END, 'Membre'),
           CASE WHEN v_role = 'manager' THEN coalesce(u.email, m.invited_email) END,
           CASE WHEN v_role = 'manager' THEN m.invite_expires_at END,
           CASE m.status WHEN 'active' THEN 1 WHEN 'invited' THEN 2 ELSE 3 END
    FROM public.booth_team_members m
    LEFT JOIN public.profiles p ON p.user_id = m.user_id
    LEFT JOIN auth.users u ON u.id = m.user_id
    WHERE m.exhibitor_id = p_exhibitor_id
      AND (m.status = 'active' OR (v_role = 'manager' AND m.status = 'invited'))
  ) x;

  RETURN jsonb_build_object('role', v_role, 'items', v_items);
END $$;

-- =========================================================================
-- 8. Contexte de l'utilisateur connecté (point d'entrée du site)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.booth_my_context()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := public._booth_require_user();
  v_items jsonb;
BEGIN
  SELECT coalesce(jsonb_agg(row_to_json(x) ORDER BY x.exhibitor_name), '[]'::jsonb)
    INTO v_items
  FROM (
    SELECT ex.id AS exhibitor_id, ex.name AS exhibitor_name, ex.slug AS exhibitor_slug, ex.logo_url,
           public.booth_role(ex.id) AS role,
           coalesce(a.status, 'none') AS access_status,
           a.plan, a.plan_valid_until,
           public._booth_is_paid(ex.id) AS is_paid,
           public._booth_is_fiche_manager(ex.id, v_uid) AS is_fiche_manager
    FROM public.exhibitors ex
    LEFT JOIN public.booth_access a ON a.exhibitor_id = ex.id
    WHERE ex.id IN (
      SELECT t.exhibitor_id FROM public.exhibitor_team_members t
       WHERE t.user_id = v_uid AND t.status = 'active' AND t.role IN ('owner','admin')
      UNION
      SELECT m.exhibitor_id FROM public.booth_team_members m
       WHERE m.user_id = v_uid AND m.status = 'active'
    )
  ) x;

  RETURN jsonb_build_object('items', v_items);
END $$;

-- =========================================================================
-- 9. Privilèges
-- =========================================================================
REVOKE ALL ON FUNCTION public._booth_require_user()                 FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._booth_is_paid(uuid)                  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._booth_has_full_features(uuid, uuid)  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._booth_is_fiche_manager(uuid, uuid)   FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._booth_require_user(), public._booth_is_paid(uuid),
                          public._booth_has_full_features(uuid, uuid), public._booth_is_fiche_manager(uuid, uuid)
  TO service_role;

-- booth_role() reste réservée aux fonctions serveur (décision du Lot 1)
REVOKE ALL ON FUNCTION public.booth_role(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.booth_role(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.booth_request_access(uuid, uuid, integer, text)                       FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.booth_get_access(uuid)                                                FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.booth_admin_list_access(text)                                         FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.booth_admin_review_access(uuid, text, text, text, uuid, timestamptz)  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.booth_create_workspace(uuid, uuid, text, text)                        FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.booth_update_workspace(uuid, text, numeric, text, boolean, boolean)   FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.booth_list_workspaces(uuid)                                           FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.booth_invite_member(uuid, text, text)                                 FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.booth_accept_invite(text)                                             FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.booth_revoke_member(uuid)                                             FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.booth_list_members(uuid)                                              FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.booth_my_context()                                                    FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION
  public.booth_request_access(uuid, uuid, integer, text),
  public.booth_get_access(uuid),
  public.booth_admin_list_access(text),
  public.booth_admin_review_access(uuid, text, text, text, uuid, timestamptz),
  public.booth_create_workspace(uuid, uuid, text, text),
  public.booth_update_workspace(uuid, text, numeric, text, boolean, boolean),
  public.booth_list_workspaces(uuid),
  public.booth_invite_member(uuid, text, text),
  public.booth_accept_invite(text),
  public.booth_revoke_member(uuid),
  public.booth_list_members(uuid),
  public.booth_my_context()
TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
