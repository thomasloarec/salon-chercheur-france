-- Lotexpo Leads : lot 4 (saisie sur le stand)
-- Synchronisation hors réseau sans doublon, amorçage de l'application, recherches,
-- détection et fusion des doublons de contacts.
-- Additif uniquement : aucune table existante n'est modifiée en profondeur, aucune ligne n'est retirée.

-- =========================================================================
-- 1. Colonnes additives
-- =========================================================================
ALTER TABLE public.booth_contacts
  ADD COLUMN IF NOT EXISTS client_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_by uuid;  -- trace simple, sans clé étrangère (n'empêche jamais la clôture d'un compte)
ALTER TABLE public.booth_opportunities
  ADD COLUMN IF NOT EXISTS client_updated_at timestamptz;

CREATE INDEX IF NOT EXISTS booth_contacts_exhibitor_updated_idx ON public.booth_contacts (exhibitor_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS booth_interactions_ws_updated_idx ON public.booth_interactions (workspace_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS booth_opportunities_ws_updated_idx ON public.booth_opportunities (workspace_id, updated_at DESC);

-- Recherche d'entreprises Lotexpo (31 000 fiches) : index trigramme sur la vue matérialisée
CREATE INDEX IF NOT EXISTS booth_pep_mv_search_trgm
  ON public.public_exhibitor_profiles_mv
  USING gin (lower(coalesce(display_name, '') || ' ' || coalesce(website, '')) extensions.gin_trgm_ops);

-- =========================================================================
-- 2. Fonctions internes
-- =========================================================================

-- Téléphone normalisé : format international quand c'est possible (+33 pour les numéros français à 10 chiffres)
CREATE OR REPLACE FUNCTION public._booth_norm_phone(p text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  s text;
  digits text;
BEGIN
  IF p IS NULL THEN RETURN NULL; END IF;
  s := regexp_replace(btrim(p), '[^0-9+]', '', 'g');
  IF s LIKE '00%' THEN s := '+' || substr(s, 3); END IF;
  digits := regexp_replace(s, '\D', '', 'g');
  IF length(digits) < 6 OR length(digits) > 20 THEN RETURN NULL; END IF;
  IF left(s, 1) = '+' THEN
    IF digits LIKE '330%' AND length(digits) = 12 THEN
      digits := '33' || substr(digits, 4);
    END IF;
    RETURN '+' || digits;
  END IF;
  IF length(digits) = 10 AND left(digits, 1) = '0' THEN
    RETURN '+33' || substr(digits, 2);
  END IF;
  RETURN digits;
END $$;

-- Calcul automatique de phone_norm (le client ne l'envoie jamais)
CREATE OR REPLACE FUNCTION public.booth_contacts_normalize()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.phone_norm := public._booth_norm_phone(NEW.phone);
  RETURN NEW;
END $$;

CREATE OR REPLACE TRIGGER booth_contacts_normalize
  BEFORE INSERT OR UPDATE OF phone ON public.booth_contacts
  FOR EACH ROW EXECUTE FUNCTION public.booth_contacts_normalize();

-- Texte nettoyé avec longueur maximale
CREATE OR REPLACE FUNCTION public._booth_txt(d jsonb, k text, maxlen int)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v text := nullif(btrim(d->>k), '');
BEGIN
  IF v IS NOT NULL AND length(v) > maxlen THEN
    RAISE EXCEPTION 'BOOTH_INVALID_INPUT';
  END IF;
  RETURN v;
END $$;

-- Membre de l'équipe (owner/admin de la fiche ou membre invité actif)
CREATE OR REPLACE FUNCTION public._booth_is_team_user(p_exhibitor_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT p_user_id IS NOT NULL AND (
    public._booth_is_fiche_manager(p_exhibitor_id, p_user_id)
    OR EXISTS (SELECT 1 FROM public.booth_team_members m
               WHERE m.exhibitor_id = p_exhibitor_id AND m.user_id = p_user_id AND m.status = 'active')
  )
$$;

-- Contact cible d'une rencontre : suit les fusions (un téléphone hors réseau peut référencer un contact fusionné)
CREATE OR REPLACE FUNCTION public._booth_resolve_contact(p_exhibitor_id uuid, p_contact_id uuid)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_id uuid := p_contact_id;
  v_next uuid;
  v_ex uuid;
  n int := 0;
BEGIN
  LOOP
    SELECT exhibitor_id, merged_into_id INTO v_ex, v_next FROM public.booth_contacts WHERE id = v_id;
    IF NOT FOUND OR v_ex <> p_exhibitor_id THEN
      RAISE EXCEPTION 'BOOTH_NOT_FOUND';
    END IF;
    EXIT WHEN v_next IS NULL;
    v_id := v_next;
    n := n + 1;
    IF n > 10 THEN RAISE EXCEPTION 'BOOTH_NOT_FOUND'; END IF;
  END LOOP;
  RETURN v_id;
END $$;

-- Horodatage client borné (une horloge en avance ne doit pas bloquer les corrections suivantes)
CREATE OR REPLACE FUNCTION public._booth_client_ts(p_item jsonb)
RETURNS timestamptz
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT least(coalesce((p_item->>'client_updated_at')::timestamptz, now()), now() + interval '5 minutes')
$$;

-- -------------------------------------------------------------------------
-- 2a. Synchronisation d'un contact
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._booth_sync_contact(p_exhibitor_id uuid, p_role text, p_uid uuid, p_item jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  d jsonb := coalesce(p_item->'data', '{}'::jsonb);
  v_id uuid := (p_item->>'id')::uuid;
  v_cu timestamptz := public._booth_client_ts(p_item);
  c public.booth_contacts%ROWTYPE;
  n public.booth_contacts%ROWTYPE;
BEGIN
  IF v_id IS NULL OR jsonb_typeof(d) <> 'object' THEN
    RAISE EXCEPTION 'BOOTH_INVALID_INPUT';
  END IF;

  SELECT * INTO c FROM public.booth_contacts WHERE id = v_id FOR UPDATE;

  IF NOT FOUND THEN
    n.id := v_id;
    n.exhibitor_id := p_exhibitor_id;
    n.source := coalesce(public._booth_txt(d, 'source', 20), 'manual');
    n.created_by := p_uid;
  ELSE
    IF c.exhibitor_id <> p_exhibitor_id THEN
      RAISE EXCEPTION 'BOOTH_NOT_FOUND';
    END IF;
    IF c.merged_into_id IS NOT NULL THEN
      RETURN jsonb_build_object('status', 'merged', 'merged_into_id', public._booth_resolve_contact(p_exhibitor_id, c.id));
    END IF;
    IF p_role <> 'manager' AND c.created_by IS DISTINCT FROM p_uid THEN
      RAISE EXCEPTION 'BOOTH_FORBIDDEN';
    END IF;
    IF c.client_updated_at IS NOT NULL AND v_cu < c.client_updated_at THEN
      RETURN jsonb_build_object('status', 'stale', 'row', to_jsonb(c));
    END IF;
    IF c.client_updated_at IS NOT NULL AND v_cu = c.client_updated_at THEN
      RETURN jsonb_build_object('status', 'unchanged');
    END IF;
    n := c;
  END IF;

  IF d ? 'first_name'   THEN n.first_name   := public._booth_txt(d, 'first_name', 200); END IF;
  IF d ? 'last_name'    THEN n.last_name    := public._booth_txt(d, 'last_name', 200); END IF;
  IF d ? 'company_name' THEN n.company_name := public._booth_txt(d, 'company_name', 300); END IF;
  IF d ? 'company_domain' THEN n.company_domain := lower(public._booth_txt(d, 'company_domain', 255)); END IF;
  IF d ? 'job_title'    THEN n.job_title    := public._booth_txt(d, 'job_title', 200); END IF;
  IF d ? 'email' THEN
    n.email := public._booth_txt(d, 'email', 320);
    IF n.email IS NOT NULL AND n.email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' THEN
      RAISE EXCEPTION 'BOOTH_INVALID_INPUT';
    END IF;
  END IF;
  IF d ? 'phone'        THEN n.phone        := public._booth_txt(d, 'phone', 50); END IF;
  IF d ? 'linkedin_url' THEN n.linkedin_url := public._booth_txt(d, 'linkedin_url', 500); END IF;
  IF d ? 'lotexpo_company_ref' THEN
    n.lotexpo_company_ref := public._booth_txt(d, 'lotexpo_company_ref', 64);
    IF n.lotexpo_company_ref IS NOT NULL AND NOT EXISTS (
         SELECT 1 FROM public.exhibitor_public_identities epi WHERE epi.id::text = n.lotexpo_company_ref) THEN
      RAISE EXCEPTION 'BOOTH_INVALID_INPUT';
    END IF;
  END IF;
  IF d ? 'archived' THEN
    n.archived_at := CASE WHEN (d->>'archived')::boolean THEN coalesce(n.archived_at, now()) ELSE NULL END;
  END IF;
  n.client_updated_at := v_cu;
  n.updated_by := p_uid;

  IF c.id IS NULL THEN
    INSERT INTO public.booth_contacts (id, exhibitor_id, first_name, last_name, company_name, company_domain,
      job_title, email, phone, linkedin_url, lotexpo_company_ref, source, created_by, archived_at,
      client_updated_at, updated_by)
    VALUES (n.id, n.exhibitor_id, n.first_name, n.last_name, n.company_name, n.company_domain,
      n.job_title, n.email, n.phone, n.linkedin_url, n.lotexpo_company_ref, n.source, n.created_by, n.archived_at,
      n.client_updated_at, n.updated_by)
    ON CONFLICT (id) DO NOTHING;
    IF NOT FOUND THEN
      -- Envoi concurrent du même élément : déjà enregistré
      RETURN jsonb_build_object('status', 'unchanged');
    END IF;
    RETURN jsonb_build_object('status', 'created');
  END IF;

  UPDATE public.booth_contacts
     SET first_name = n.first_name, last_name = n.last_name, company_name = n.company_name,
         company_domain = n.company_domain, job_title = n.job_title, email = n.email, phone = n.phone,
         linkedin_url = n.linkedin_url, lotexpo_company_ref = n.lotexpo_company_ref,
         archived_at = n.archived_at, client_updated_at = n.client_updated_at, updated_by = n.updated_by
   WHERE id = n.id;
  RETURN jsonb_build_object('status', 'updated');
END $$;

-- -------------------------------------------------------------------------
-- 2b. Synchronisation d'une rencontre
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._booth_sync_interaction(p_exhibitor_id uuid, p_role text, p_uid uuid, p_item jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  d jsonb := coalesce(p_item->'data', '{}'::jsonb);
  v_id uuid := (p_item->>'id')::uuid;
  v_cu timestamptz := public._booth_client_ts(p_item);
  i public.booth_interactions%ROWTYPE;
  n public.booth_interactions%ROWTYPE;
  w public.booth_workspaces%ROWTYPE;
  v_own boolean;
  v_limited boolean := false;
  k text;
BEGIN
  IF v_id IS NULL OR jsonb_typeof(d) <> 'object' THEN
    RAISE EXCEPTION 'BOOTH_INVALID_INPUT';
  END IF;

  SELECT * INTO i FROM public.booth_interactions WHERE id = v_id FOR UPDATE;

  IF NOT FOUND THEN
    SELECT * INTO w FROM public.booth_workspaces WHERE id = (d->>'workspace_id')::uuid;
    IF NOT FOUND OR w.exhibitor_id <> p_exhibitor_id THEN
      RAISE EXCEPTION 'BOOTH_NOT_FOUND';
    END IF;
    IF w.archived_at IS NOT NULL THEN
      RAISE EXCEPTION 'BOOTH_WORKSPACE_ARCHIVED';
    END IF;
    n.id := v_id;
    n.workspace_id := w.id;
    n.exhibitor_id := p_exhibitor_id;
    n.created_by := p_uid;
    n.owner_user_id := p_uid;
    n.occurred_at := now();
    n.next_action := 'none';
    n.capture_source := coalesce(public._booth_txt(d, 'capture_source', 20), 'manual');
    n.status := 'completed';
    IF NOT (d ? 'contact_id') THEN
      RAISE EXCEPTION 'BOOTH_INVALID_INPUT';
    END IF;
    IF n.capture_source = 'voice' AND NOT public._booth_has_full_features(p_exhibitor_id, w.event_id) THEN
      RAISE EXCEPTION 'BOOTH_PLAN_REQUIRED';
    END IF;
  ELSE
    IF i.exhibitor_id <> p_exhibitor_id THEN
      RAISE EXCEPTION 'BOOTH_NOT_FOUND';
    END IF;
    v_own := i.created_by = p_uid OR i.owner_user_id = p_uid;
    IF p_role <> 'manager' AND NOT coalesce(v_own, false) THEN
      -- Le responsable d'une relance peut seulement la marquer faite
      IF i.next_action_owner_id = p_uid THEN
        v_limited := true;
        FOR k IN SELECT jsonb_object_keys(d) LOOP
          IF k NOT IN ('next_action_done', 'next_action_done_at') THEN
            RAISE EXCEPTION 'BOOTH_FORBIDDEN';
          END IF;
        END LOOP;
      ELSE
        RAISE EXCEPTION 'BOOTH_FORBIDDEN';
      END IF;
    END IF;
    IF d ? 'workspace_id' AND (d->>'workspace_id')::uuid IS DISTINCT FROM i.workspace_id THEN
      RAISE EXCEPTION 'BOOTH_INVALID_INPUT';
    END IF;
    IF i.client_updated_at IS NOT NULL AND v_cu < i.client_updated_at THEN
      RETURN jsonb_build_object('status', 'stale', 'row', to_jsonb(i));
    END IF;
    IF i.client_updated_at IS NOT NULL AND v_cu = i.client_updated_at THEN
      RETURN jsonb_build_object('status', 'unchanged');
    END IF;
    n := i;
  END IF;

  IF d ? 'contact_id' THEN
    n.contact_id := public._booth_resolve_contact(p_exhibitor_id, (d->>'contact_id')::uuid);
  END IF;
  IF d ? 'occurred_at' THEN n.occurred_at := coalesce((d->>'occurred_at')::timestamptz, n.occurred_at); END IF;
  IF d ? 'relationship' THEN n.relationship := public._booth_txt(d, 'relationship', 30); END IF;
  IF d ? 'customer_topic' THEN n.customer_topic := public._booth_txt(d, 'customer_topic', 30); END IF;
  IF n.relationship IS DISTINCT FROM 'customer' THEN n.customer_topic := NULL; END IF;
  IF d ? 'potential' THEN n.potential := public._booth_txt(d, 'potential', 20); END IF;
  IF d ? 'next_action' THEN n.next_action := coalesce(public._booth_txt(d, 'next_action', 20), 'none'); END IF;
  IF d ? 'next_action_due' THEN n.next_action_due := (d->>'next_action_due')::date; END IF;
  IF d ? 'next_action_owner_id' THEN
    n.next_action_owner_id := (d->>'next_action_owner_id')::uuid;
    IF n.next_action_owner_id IS NOT NULL AND n.next_action_owner_id <> p_uid
       AND NOT public._booth_is_team_user(p_exhibitor_id, n.next_action_owner_id) THEN
      RAISE EXCEPTION 'BOOTH_INVALID_INPUT';
    END IF;
  END IF;
  IF d ? 'next_action_done' THEN
    n.next_action_done_at := CASE WHEN (d->>'next_action_done')::boolean THEN coalesce(n.next_action_done_at, now()) ELSE NULL END;
  END IF;
  IF d ? 'next_action_done_at' THEN n.next_action_done_at := (d->>'next_action_done_at')::timestamptz; END IF;
  IF d ? 'note' THEN n.note := public._booth_txt(d, 'note', 10000); END IF;
  IF d ? 'status' THEN n.status := coalesce(public._booth_txt(d, 'status', 20), 'completed'); END IF;
  IF d ? 'inbound_lead_id' THEN
    n.inbound_lead_id := (d->>'inbound_lead_id')::uuid;
    IF n.inbound_lead_id IS NOT NULL AND NOT EXISTS (
         SELECT 1 FROM public.leads l WHERE l.id = n.inbound_lead_id AND l.exhibitor_id = p_exhibitor_id) THEN
      RAISE EXCEPTION 'BOOTH_NOT_FOUND';
    END IF;
  END IF;
  IF d ? 'owner_user_id' AND (d->>'owner_user_id')::uuid IS DISTINCT FROM n.owner_user_id THEN
    IF p_role <> 'manager' THEN
      RAISE EXCEPTION 'BOOTH_FORBIDDEN';
    END IF;
    n.owner_user_id := (d->>'owner_user_id')::uuid;
    IF n.owner_user_id IS NULL OR (n.owner_user_id <> p_uid AND NOT public._booth_is_team_user(p_exhibitor_id, n.owner_user_id)) THEN
      RAISE EXCEPTION 'BOOTH_INVALID_INPUT';
    END IF;
  END IF;
  IF n.next_action = 'none' THEN
    n.next_action_due := NULL;
    n.next_action_done_at := NULL;
  END IF;
  n.client_updated_at := v_cu;
  n.updated_by := p_uid;

  IF i.id IS NULL THEN
    INSERT INTO public.booth_interactions (id, workspace_id, exhibitor_id, contact_id, owner_user_id, created_by,
      occurred_at, relationship, customer_topic, potential, next_action, next_action_due, next_action_done_at,
      next_action_owner_id, note, capture_source, inbound_lead_id, status, client_updated_at, updated_by)
    VALUES (n.id, n.workspace_id, n.exhibitor_id, n.contact_id, n.owner_user_id, n.created_by,
      n.occurred_at, n.relationship, n.customer_topic, n.potential, n.next_action, n.next_action_due, n.next_action_done_at,
      n.next_action_owner_id, n.note, n.capture_source, n.inbound_lead_id, n.status, n.client_updated_at, n.updated_by)
    ON CONFLICT (id) DO NOTHING;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('status', 'unchanged');
    END IF;
    RETURN jsonb_build_object('status', 'created', 'contact_id', n.contact_id);
  END IF;

  UPDATE public.booth_interactions
     SET contact_id = n.contact_id, owner_user_id = n.owner_user_id, occurred_at = n.occurred_at,
         relationship = n.relationship, customer_topic = n.customer_topic, potential = n.potential,
         next_action = n.next_action, next_action_due = n.next_action_due, next_action_done_at = n.next_action_done_at,
         next_action_owner_id = n.next_action_owner_id, note = n.note, inbound_lead_id = n.inbound_lead_id,
         status = n.status, client_updated_at = n.client_updated_at, updated_by = n.updated_by
   WHERE id = n.id;
  RETURN jsonb_build_object('status', 'updated', 'contact_id', n.contact_id);
END $$;

-- -------------------------------------------------------------------------
-- 2c. Synchronisation d'une opportunité
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._booth_sync_opportunity(p_exhibitor_id uuid, p_role text, p_uid uuid, p_item jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  d jsonb := coalesce(p_item->'data', '{}'::jsonb);
  v_id uuid := (p_item->>'id')::uuid;
  v_cu timestamptz := public._booth_client_ts(p_item);
  o public.booth_opportunities%ROWTYPE;
  n public.booth_opportunities%ROWTYPE;
  w public.booth_workspaces%ROWTYPE;
BEGIN
  IF v_id IS NULL OR jsonb_typeof(d) <> 'object' THEN
    RAISE EXCEPTION 'BOOTH_INVALID_INPUT';
  END IF;

  SELECT * INTO o FROM public.booth_opportunities WHERE id = v_id FOR UPDATE;

  IF NOT FOUND THEN
    SELECT * INTO w FROM public.booth_workspaces WHERE id = (d->>'workspace_id')::uuid;
    IF NOT FOUND OR w.exhibitor_id <> p_exhibitor_id THEN
      RAISE EXCEPTION 'BOOTH_NOT_FOUND';
    END IF;
    IF w.archived_at IS NOT NULL THEN
      RAISE EXCEPTION 'BOOTH_WORKSPACE_ARCHIVED';
    END IF;
    IF NOT (d ? 'contact_id') THEN
      RAISE EXCEPTION 'BOOTH_INVALID_INPUT';
    END IF;
    n.id := v_id;
    n.workspace_id := w.id;
    n.exhibitor_id := p_exhibitor_id;
    n.created_by := p_uid;
    n.owner_user_id := p_uid;
    n.currency := w.currency;
    n.status := 'open';
  ELSE
    IF o.exhibitor_id <> p_exhibitor_id THEN
      RAISE EXCEPTION 'BOOTH_NOT_FOUND';
    END IF;
    IF p_role <> 'manager' AND NOT coalesce(o.created_by = p_uid OR o.owner_user_id = p_uid, false) THEN
      RAISE EXCEPTION 'BOOTH_FORBIDDEN';
    END IF;
    IF d ? 'workspace_id' AND (d->>'workspace_id')::uuid IS DISTINCT FROM o.workspace_id THEN
      RAISE EXCEPTION 'BOOTH_INVALID_INPUT';
    END IF;
    IF o.client_updated_at IS NOT NULL AND v_cu < o.client_updated_at THEN
      RETURN jsonb_build_object('status', 'stale', 'row', to_jsonb(o));
    END IF;
    IF o.client_updated_at IS NOT NULL AND v_cu = o.client_updated_at THEN
      RETURN jsonb_build_object('status', 'unchanged');
    END IF;
    n := o;
  END IF;

  IF d ? 'contact_id' THEN
    n.contact_id := public._booth_resolve_contact(p_exhibitor_id, (d->>'contact_id')::uuid);
  END IF;
  IF d ? 'origin_interaction_id' THEN
    n.origin_interaction_id := (d->>'origin_interaction_id')::uuid;
    IF n.origin_interaction_id IS NOT NULL AND NOT EXISTS (
         SELECT 1 FROM public.booth_interactions x WHERE x.id = n.origin_interaction_id AND x.exhibitor_id = p_exhibitor_id) THEN
      RAISE EXCEPTION 'BOOTH_NOT_FOUND';
    END IF;
  END IF;
  IF d ? 'title' THEN n.title := public._booth_txt(d, 'title', 300); END IF;
  IF d ? 'value_band' THEN n.value_band := public._booth_txt(d, 'value_band', 20); END IF;
  IF d ? 'amount' THEN n.amount := (d->>'amount')::numeric; END IF;
  IF d ? 'currency' THEN n.currency := coalesce(upper(public._booth_txt(d, 'currency', 3)), n.currency); END IF;
  IF d ? 'horizon' THEN n.horizon := public._booth_txt(d, 'horizon', 10); END IF;
  IF d ? 'probability' THEN n.probability := (d->>'probability')::smallint; END IF;
  IF d ? 'status' THEN n.status := coalesce(public._booth_txt(d, 'status', 20), 'open'); END IF;
  IF d ? 'won_amount' THEN n.won_amount := (d->>'won_amount')::numeric; END IF;
  IF d ? 'won_at' THEN n.won_at := (d->>'won_at')::timestamptz; END IF;
  IF d ? 'lost_at' THEN n.lost_at := (d->>'lost_at')::timestamptz; END IF;
  IF d ? 'owner_user_id' AND (d->>'owner_user_id')::uuid IS DISTINCT FROM n.owner_user_id THEN
    IF p_role <> 'manager' THEN
      RAISE EXCEPTION 'BOOTH_FORBIDDEN';
    END IF;
    n.owner_user_id := (d->>'owner_user_id')::uuid;
    IF n.owner_user_id IS NULL OR (n.owner_user_id <> p_uid AND NOT public._booth_is_team_user(p_exhibitor_id, n.owner_user_id)) THEN
      RAISE EXCEPTION 'BOOTH_INVALID_INPUT';
    END IF;
  END IF;

  -- Cohérence du statut
  IF n.status = 'won' THEN
    n.won_at := coalesce(n.won_at, now());
    n.lost_at := NULL;
  ELSIF n.status IN ('lost', 'abandoned') THEN
    n.won_at := NULL;
    n.won_amount := NULL;
    n.lost_at := coalesce(n.lost_at, now());
  ELSE
    n.won_at := NULL;
    n.won_amount := NULL;
    n.lost_at := NULL;
  END IF;
  n.client_updated_at := v_cu;
  n.updated_by := p_uid;

  IF o.id IS NULL THEN
    INSERT INTO public.booth_opportunities (id, workspace_id, exhibitor_id, contact_id, origin_interaction_id, title,
      value_band, amount, currency, horizon, probability, status, won_amount, won_at, lost_at, owner_user_id,
      created_by, client_updated_at, updated_by)
    VALUES (n.id, n.workspace_id, n.exhibitor_id, n.contact_id, n.origin_interaction_id, n.title,
      n.value_band, n.amount, n.currency, n.horizon, n.probability, n.status, n.won_amount, n.won_at, n.lost_at, n.owner_user_id,
      n.created_by, n.client_updated_at, n.updated_by)
    ON CONFLICT (id) DO NOTHING;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('status', 'unchanged');
    END IF;
    RETURN jsonb_build_object('status', 'created');
  END IF;

  UPDATE public.booth_opportunities
     SET contact_id = n.contact_id, origin_interaction_id = n.origin_interaction_id, title = n.title,
         value_band = n.value_band, amount = n.amount, currency = n.currency, horizon = n.horizon,
         probability = n.probability, status = n.status, won_amount = n.won_amount, won_at = n.won_at,
         lost_at = n.lost_at, owner_user_id = n.owner_user_id, client_updated_at = n.client_updated_at,
         updated_by = n.updated_by
   WHERE id = n.id;
  RETURN jsonb_build_object('status', 'updated');
END $$;

-- =========================================================================
-- 3. booth_sync : reçoit d'un coup tout ce que le téléphone a enregistré
--    Un élément en erreur n'empêche pas les autres d'être enregistrés.
-- =========================================================================
CREATE OR REPLACE FUNCTION public.booth_sync(p_exhibitor_id uuid, p_items jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := public._booth_require_user();
  v_role text;
  rec record;
  v_res jsonb;
  v_results jsonb := '[]'::jsonb;
  v_state text;
  v_msg text;
  v_code text;
BEGIN
  v_role := public.booth_role(p_exhibitor_id);
  IF v_role IS NULL THEN
    RAISE EXCEPTION 'BOOTH_FORBIDDEN';
  END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) > 200 THEN
    RAISE EXCEPTION 'BOOTH_INVALID_INPUT';
  END IF;

  FOR rec IN
    SELECT (x.ord - 1)::int AS idx, x.item
    FROM jsonb_array_elements(p_items) WITH ORDINALITY AS x(item, ord)
    ORDER BY CASE x.item->>'kind' WHEN 'contact' THEN 1 WHEN 'interaction' THEN 2 WHEN 'opportunity' THEN 3 ELSE 4 END, x.ord
  LOOP
    BEGIN
      IF jsonb_typeof(rec.item) <> 'object' THEN
        RAISE EXCEPTION 'BOOTH_INVALID_INPUT';
      END IF;
      v_res := CASE rec.item->>'kind'
        WHEN 'contact'     THEN public._booth_sync_contact(p_exhibitor_id, v_role, v_uid, rec.item)
        WHEN 'interaction' THEN public._booth_sync_interaction(p_exhibitor_id, v_role, v_uid, rec.item)
        WHEN 'opportunity' THEN public._booth_sync_opportunity(p_exhibitor_id, v_role, v_uid, rec.item)
      END;
      IF v_res IS NULL THEN
        RAISE EXCEPTION 'BOOTH_INVALID_INPUT';
      END IF;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE, v_msg = MESSAGE_TEXT;
      v_code := CASE
        WHEN left(v_msg, 6) = 'BOOTH_' THEN v_msg
        WHEN v_state = '23503' THEN 'BOOTH_NOT_FOUND'
        WHEN v_state LIKE '22%' OR v_state IN ('23502', '23514') THEN 'BOOTH_INVALID_INPUT'
        ELSE 'BOOTH_ERROR'
      END;
      v_res := jsonb_build_object('status', 'error', 'error', v_code);
      IF v_code = 'BOOTH_ERROR' THEN
        v_res := v_res || jsonb_build_object('sqlstate', v_state);
      END IF;
    END;
    v_results := v_results || jsonb_build_array(
      jsonb_build_object('index', rec.idx, 'kind', rec.item->>'kind', 'id', rec.item->>'id') || v_res);
  END LOOP;

  RETURN jsonb_build_object(
    'server_time', now(),
    'results', coalesce((SELECT jsonb_agg(r ORDER BY (r->>'index')::int) FROM jsonb_array_elements(v_results) r), '[]'::jsonb),
    'counts', coalesce((SELECT jsonb_object_agg(s, c) FROM (
                SELECT r->>'status' AS s, count(*) AS c FROM jsonb_array_elements(v_results) r GROUP BY 1) z), '{}'::jsonb)
  );
END $$;

-- =========================================================================
-- 4. booth_bootstrap : tout ce dont l'application a besoin pour un salon
--    p_since : ne renvoie que ce qui a changé depuis (synchronisation incrémentale)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.booth_bootstrap(p_workspace_id uuid, p_since timestamptz DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
END $$;

-- =========================================================================
-- 5. Recherches
-- =========================================================================
CREATE OR REPLACE FUNCTION public.booth_search_contacts(p_exhibitor_id uuid, p_query text, p_limit int DEFAULT 20)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_q text := lower(btrim(coalesce(p_query, '')));
  v_tokens text[];
  v_digits text;
  v_limit int := greatest(1, least(coalesce(p_limit, 20), 50));
  v_total bigint;
  v_items jsonb;
BEGIN
  PERFORM public._booth_require_user();
  IF public.booth_role(p_exhibitor_id) IS NULL THEN
    RAISE EXCEPTION 'BOOTH_FORBIDDEN';
  END IF;
  IF length(v_q) < 2 OR length(v_q) > 100 THEN
    RAISE EXCEPTION 'BOOTH_INVALID_INPUT';
  END IF;
  v_q := replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_');
  v_tokens := regexp_split_to_array(v_q, '\s+');
  v_digits := regexp_replace(v_q, '\D', '', 'g');

  WITH m AS (
    SELECT c.*,
           lower(coalesce(c.first_name, '') || ' ' || coalesce(c.last_name, '') || ' ' || coalesce(c.company_name, '')
                 || ' ' || coalesce(c.email_norm, '')) AS hay
    FROM public.booth_contacts c
    WHERE c.exhibitor_id = p_exhibitor_id AND c.archived_at IS NULL AND c.merged_into_id IS NULL
  ), f AS (
    SELECT m.* FROM m
    WHERE NOT EXISTS (SELECT 1 FROM unnest(v_tokens) t WHERE m.hay NOT LIKE '%' || t || '%')
       OR (length(v_digits) >= 4 AND m.phone_norm LIKE '%' || v_digits || '%')
  )
  SELECT (SELECT count(*) FROM f),
         coalesce(jsonb_agg(jsonb_build_object(
           'id', x.id, 'first_name', x.first_name, 'last_name', x.last_name, 'company_name', x.company_name,
           'job_title', x.job_title, 'email', x.email, 'phone', x.phone, 'lotexpo_company_ref', x.lotexpo_company_ref,
           'interactions_count', (SELECT count(*) FROM public.booth_interactions i WHERE i.contact_id = x.id AND i.status = 'completed'),
           'last_interaction_at', (SELECT max(i.occurred_at) FROM public.booth_interactions i WHERE i.contact_id = x.id AND i.status = 'completed'))
           ORDER BY x.rk, x.updated_at DESC), '[]'::jsonb)
    INTO v_total, v_items
  FROM (
    SELECT f.*, CASE WHEN f.hay LIKE v_tokens[1] || '%'
                       OR lower(coalesce(f.last_name, '')) LIKE v_tokens[1] || '%'
                       OR lower(coalesce(f.company_name, '')) LIKE v_tokens[1] || '%' THEN 0 ELSE 1 END AS rk
    FROM f ORDER BY rk, f.updated_at DESC LIMIT v_limit
  ) x;

  RETURN jsonb_build_object('total', v_total, 'items', v_items);
END $$;

CREATE OR REPLACE FUNCTION public.booth_search_companies(p_query text, p_limit int DEFAULT 10)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_q text := lower(btrim(coalesce(p_query, '')));
  v_tokens text[];
  v_limit int := greatest(1, least(coalesce(p_limit, 10), 20));
  v_total bigint;
  v_items jsonb;
BEGIN
  PERFORM public._booth_require_user();
  IF length(v_q) < 2 OR length(v_q) > 100 THEN
    RAISE EXCEPTION 'BOOTH_INVALID_INPUT';
  END IF;
  v_q := replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_');
  v_tokens := regexp_split_to_array(v_q, '\s+');

  WITH f AS (
    SELECT p.public_identity_id, p.exhibitor_id, p.display_name, p.website, p.logo_url, p.public_slug,
           p.total_participations
    FROM public.public_exhibitor_profiles_mv p
    WHERE p.is_active AND NOT p.is_test
      AND lower(coalesce(p.display_name, '') || ' ' || coalesce(p.website, '')) LIKE '%' || v_tokens[1] || '%'
      AND NOT EXISTS (SELECT 1 FROM unnest(v_tokens) t
                      WHERE lower(coalesce(p.display_name, '') || ' ' || coalesce(p.website, '')) NOT LIKE '%' || t || '%')
  )
  SELECT (SELECT count(*) FROM f),
         coalesce(jsonb_agg(jsonb_build_object(
           'public_identity_id', x.public_identity_id, 'exhibitor_id', x.exhibitor_id, 'name', x.display_name,
           'website', x.website,
           'domain', nullif(split_part(regexp_replace(regexp_replace(lower(coalesce(x.website, '')), '^https?://', ''), '^www\.', ''), '/', 1), ''),
           'logo_url', x.logo_url, 'public_slug', x.public_slug)
           ORDER BY x.rk, x.total_participations DESC NULLS LAST, x.display_name), '[]'::jsonb)
    INTO v_total, v_items
  FROM (
    SELECT f.*, CASE WHEN lower(coalesce(f.display_name, '')) LIKE v_q || '%' THEN 0 ELSE 1 END AS rk
    FROM f ORDER BY rk, f.total_participations DESC NULLS LAST, f.display_name LIMIT v_limit
  ) x;

  RETURN jsonb_build_object('total', v_total, 'items', v_items);
END $$;

-- =========================================================================
-- 6. Doublons et fusion (managers uniquement ; aucune ligne n'est retirée)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.booth_find_duplicates(p_exhibitor_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total bigint;
  v_items jsonb;
BEGIN
  PERFORM public._booth_require_user();
  IF public.booth_role(p_exhibitor_id) IS DISTINCT FROM 'manager' THEN
    RAISE EXCEPTION 'BOOTH_FORBIDDEN';
  END IF;

  WITH act AS (
    SELECT * FROM public.booth_contacts c
    WHERE c.exhibitor_id = p_exhibitor_id AND c.archived_at IS NULL AND c.merged_into_id IS NULL
  ), g AS (
    SELECT 'email' AS match, email_norm AS value, array_agg(id ORDER BY created_at) AS ids
      FROM act WHERE email_norm IS NOT NULL GROUP BY email_norm HAVING count(*) > 1
    UNION ALL
    SELECT 'phone', phone_norm, array_agg(id ORDER BY created_at)
      FROM act WHERE phone_norm IS NOT NULL GROUP BY phone_norm HAVING count(*) > 1
  )
  SELECT (SELECT count(*) FROM g),
         coalesce(jsonb_agg(jsonb_build_object(
           'match', g2.match, 'value', g2.value,
           'contacts', (SELECT jsonb_agg(jsonb_build_object(
                          'id', c.id, 'first_name', c.first_name, 'last_name', c.last_name,
                          'company_name', c.company_name, 'email', c.email, 'phone', c.phone,
                          'created_at', c.created_at, 'created_by', c.created_by,
                          'interactions_count', (SELECT count(*) FROM public.booth_interactions i WHERE i.contact_id = c.id))
                          ORDER BY c.created_at)
                        FROM public.booth_contacts c WHERE c.id = ANY (g2.ids)))), '[]'::jsonb)
    INTO v_total, v_items
  FROM (SELECT * FROM g ORDER BY g.match, g.value LIMIT 200) g2;

  RETURN jsonb_build_object('total', v_total, 'items', v_items);
END $$;

CREATE OR REPLACE FUNCTION public.booth_merge_contacts(p_keep_id uuid, p_merge_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := public._booth_require_user();
  k public.booth_contacts%ROWTYPE;
  m public.booth_contacts%ROWTYPE;
  v_role text;
  n_int int;
  n_opp int;
  n_chain int;
BEGIN
  IF p_keep_id IS NULL OR p_merge_id IS NULL OR p_keep_id = p_merge_id THEN
    RAISE EXCEPTION 'BOOTH_INVALID_INPUT';
  END IF;
  -- Verrouillage dans un ordre stable
  PERFORM 1 FROM public.booth_contacts WHERE id IN (p_keep_id, p_merge_id) ORDER BY id FOR UPDATE;
  SELECT * INTO k FROM public.booth_contacts WHERE id = p_keep_id;
  SELECT * INTO m FROM public.booth_contacts WHERE id = p_merge_id;
  IF k.id IS NULL OR m.id IS NULL OR k.exhibitor_id <> m.exhibitor_id THEN
    RAISE EXCEPTION 'BOOTH_NOT_FOUND';
  END IF;
  v_role := public.booth_role(k.exhibitor_id);
  IF v_role IS NULL THEN
    RAISE EXCEPTION 'BOOTH_NOT_FOUND';
  END IF;
  IF v_role <> 'manager' THEN
    RAISE EXCEPTION 'BOOTH_FORBIDDEN';
  END IF;
  IF k.merged_into_id IS NOT NULL OR m.merged_into_id IS NOT NULL THEN
    RAISE EXCEPTION 'BOOTH_ALREADY_MERGED';
  END IF;

  UPDATE public.booth_interactions SET contact_id = k.id, updated_by = v_uid
   WHERE contact_id = m.id AND exhibitor_id = k.exhibitor_id;
  GET DIAGNOSTICS n_int = ROW_COUNT;
  UPDATE public.booth_opportunities SET contact_id = k.id, updated_by = v_uid
   WHERE contact_id = m.id AND exhibitor_id = k.exhibitor_id;
  GET DIAGNOSTICS n_opp = ROW_COUNT;
  -- Contacts déjà fusionnés dans celui qu'on fusionne : rattachés directement au contact conservé
  UPDATE public.booth_contacts SET merged_into_id = k.id, updated_by = v_uid
   WHERE merged_into_id = m.id;
  GET DIAGNOSTICS n_chain = ROW_COUNT;

  -- Le contact conservé récupère les informations qui lui manquent
  UPDATE public.booth_contacts
     SET first_name = coalesce(k.first_name, m.first_name),
         last_name = coalesce(k.last_name, m.last_name),
         company_name = coalesce(k.company_name, m.company_name),
         company_domain = coalesce(k.company_domain, m.company_domain),
         job_title = coalesce(k.job_title, m.job_title),
         email = coalesce(k.email, m.email),
         phone = coalesce(k.phone, m.phone),
         linkedin_url = coalesce(k.linkedin_url, m.linkedin_url),
         lotexpo_company_ref = coalesce(k.lotexpo_company_ref, m.lotexpo_company_ref),
         updated_by = v_uid
   WHERE id = k.id;

  UPDATE public.booth_contacts
     SET merged_into_id = k.id, archived_at = coalesce(archived_at, now()), updated_by = v_uid
   WHERE id = m.id;

  RETURN jsonb_build_object('keep_id', k.id, 'merged_id', m.id,
    'interactions_moved', n_int, 'opportunities_moved', n_opp, 'previous_merges_moved', n_chain);
END $$;

-- =========================================================================
-- 7. Privilèges
-- =========================================================================
REVOKE ALL ON FUNCTION public._booth_norm_phone(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.booth_contacts_normalize() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._booth_txt(jsonb, text, int) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._booth_is_team_user(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._booth_resolve_contact(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._booth_client_ts(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._booth_sync_contact(uuid, text, uuid, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._booth_sync_interaction(uuid, text, uuid, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._booth_sync_opportunity(uuid, text, uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._booth_norm_phone(text) TO service_role;
GRANT EXECUTE ON FUNCTION public._booth_txt(jsonb, text, int) TO service_role;
GRANT EXECUTE ON FUNCTION public._booth_is_team_user(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public._booth_resolve_contact(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public._booth_client_ts(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public._booth_sync_contact(uuid, text, uuid, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public._booth_sync_interaction(uuid, text, uuid, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public._booth_sync_opportunity(uuid, text, uuid, jsonb) TO service_role;

REVOKE ALL ON FUNCTION public.booth_sync(uuid, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.booth_bootstrap(uuid, timestamptz) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.booth_search_contacts(uuid, text, int) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.booth_search_companies(text, int) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.booth_find_duplicates(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.booth_merge_contacts(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.booth_sync(uuid, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.booth_bootstrap(uuid, timestamptz) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.booth_search_contacts(uuid, text, int) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.booth_search_companies(text, int) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.booth_find_duplicates(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.booth_merge_contacts(uuid, uuid) TO authenticated, service_role;
