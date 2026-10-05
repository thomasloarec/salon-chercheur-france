-- Lotexpo Leads, Lot 1 : socle de données (6 tables booth_, fonctions d'accès, RLS, privilèges, index)
-- Migration purement additive. Aucune table existante n'est modifiée.

-- =========================================================================
-- 1. Interrupteur global
-- =========================================================================
CREATE OR REPLACE FUNCTION public.booth_enabled()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$ SELECT true $$;

COMMENT ON FUNCTION public.booth_enabled() IS
  'Interrupteur global Lotexpo Leads. Remplacer par SELECT false pour couper tout le module instantanément.';

-- =========================================================================
-- 2. Tables
-- =========================================================================

-- 2.1 Accès bêta (une ligne par exposant)
CREATE TABLE public.booth_access (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exhibitor_id     uuid NOT NULL UNIQUE REFERENCES public.exhibitors(id) ON DELETE RESTRICT,
  status           text NOT NULL DEFAULT 'requested'
                   CHECK (status IN ('requested','approved','rejected','revoked')),
  requested_by     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  target_event_id  uuid REFERENCES public.events(id) ON DELETE SET NULL,
  team_size        integer CHECK (team_size IS NULL OR team_size BETWEEN 1 AND 1000),
  message          text CHECK (message IS NULL OR length(message) <= 2000),
  admin_note       text CHECK (admin_note IS NULL OR length(admin_note) <= 2000),
  reviewed_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at      timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- 2.2 Équipe commerciale de l'exposant (tous ses salons)
CREATE TABLE public.booth_team_members (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exhibitor_id       uuid NOT NULL REFERENCES public.exhibitors(id) ON DELETE RESTRICT,
  user_id            uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  invited_email      text CHECK (invited_email IS NULL OR invited_email = lower(btrim(invited_email))),
  invite_token_hash  text UNIQUE,
  invite_expires_at  timestamptz,
  role               text NOT NULL CHECK (role IN ('manager','field')),
  status             text NOT NULL DEFAULT 'invited' CHECK (status IN ('invited','active','revoked')),
  invited_by         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  revoked_at         timestamptz,
  CONSTRAINT booth_team_members_active_has_user CHECK (status <> 'active' OR user_id IS NOT NULL),
  CONSTRAINT booth_team_members_identity CHECK (user_id IS NOT NULL OR invited_email IS NOT NULL),
  CONSTRAINT booth_team_members_exhibitor_user_key UNIQUE (exhibitor_id, user_id)
);
CREATE UNIQUE INDEX booth_team_members_pending_email_key
  ON public.booth_team_members (exhibitor_id, invited_email)
  WHERE status = 'invited' AND invited_email IS NOT NULL;
CREATE INDEX booth_team_members_user_idx ON public.booth_team_members (user_id) WHERE status = 'active';

-- 2.3 Espace d'un exposant sur un salon
CREATE TABLE public.booth_workspaces (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exhibitor_id  uuid NOT NULL REFERENCES public.exhibitors(id) ON DELETE RESTRICT,
  event_id      uuid NOT NULL REFERENCES public.events(id) ON DELETE RESTRICT,
  timezone      text NOT NULL DEFAULT 'Europe/Paris',
  currency      text NOT NULL DEFAULT 'EUR' CHECK (currency ~ '^[A-Z]{3}$'),
  total_cost    numeric(12,2) CHECK (total_cost IS NULL OR total_cost >= 0),
  stand_label   text CHECK (stand_label IS NULL OR length(stand_label) <= 100),
  created_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  archived_at   timestamptz,
  CONSTRAINT booth_workspaces_exhibitor_event_key UNIQUE (exhibitor_id, event_id),
  CONSTRAINT booth_workspaces_id_exhibitor_key UNIQUE (id, exhibitor_id)
);
CREATE INDEX booth_workspaces_event_idx ON public.booth_workspaces (event_id);

-- 2.4 Carnet de contacts privé de l'exposant
CREATE TABLE public.booth_contacts (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exhibitor_id         uuid NOT NULL REFERENCES public.exhibitors(id) ON DELETE RESTRICT,
  first_name           text,
  last_name            text,
  company_name         text,
  company_domain       text,
  job_title            text,
  email                text,
  email_norm           text GENERATED ALWAYS AS (lower(btrim(email))) STORED,
  phone                text,
  phone_norm           text,
  linkedin_url         text,
  lotexpo_company_ref  text,
  source               text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','card','search','qr')),
  created_by           uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  archived_at          timestamptz,
  merged_into_id       uuid,
  CONSTRAINT booth_contacts_id_exhibitor_key UNIQUE (id, exhibitor_id),
  CONSTRAINT booth_contacts_merged_same_exhibitor
    FOREIGN KEY (merged_into_id, exhibitor_id) REFERENCES public.booth_contacts (id, exhibitor_id) ON DELETE RESTRICT,
  CONSTRAINT booth_contacts_not_self_merged CHECK (merged_into_id IS NULL OR merged_into_id <> id),
  CONSTRAINT booth_contacts_has_identity CHECK (
    num_nonnulls(nullif(btrim(first_name),''), nullif(btrim(last_name),''),
                 nullif(btrim(company_name),''), nullif(btrim(email),''), nullif(btrim(phone),'')) > 0)
);
CREATE INDEX booth_contacts_email_idx ON public.booth_contacts (exhibitor_id, email_norm) WHERE email_norm IS NOT NULL;
CREATE INDEX booth_contacts_phone_idx ON public.booth_contacts (exhibitor_id, phone_norm) WHERE phone_norm IS NOT NULL;
CREATE INDEX booth_contacts_search_trgm ON public.booth_contacts USING gin (
  (lower(coalesce(first_name,'') || ' ' || coalesce(last_name,'') || ' ' || coalesce(company_name,'')))
  extensions.gin_trgm_ops);
CREATE INDEX booth_contacts_merged_idx ON public.booth_contacts (merged_into_id) WHERE merged_into_id IS NOT NULL;

-- 2.5 Rencontres (avec la prochaine action intégrée)
CREATE TABLE public.booth_interactions (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id         uuid NOT NULL,
  exhibitor_id         uuid NOT NULL,
  contact_id           uuid NOT NULL,
  owner_user_id        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by           uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  occurred_at          timestamptz NOT NULL DEFAULT now(),
  relationship         text NOT NULL CHECK (relationship IN ('new_prospect','customer','partner','other')),
  customer_topic       text CHECK (customer_topic IS NULL OR customer_topic IN ('new_project','existing_business','relationship')),
  potential            text CHECK (potential IS NULL OR potential IN ('hot','good','explore','none')),
  is_field_lead        boolean GENERATED ALWAYS AS (
                         relationship = 'new_prospect' AND coalesce(potential IN ('hot','good','explore'), false)
                       ) STORED,
  next_action          text NOT NULL DEFAULT 'none'
                       CHECK (next_action IN ('call','send_doc','quote','meeting','email','other','none')),
  next_action_due      date,
  next_action_done_at  timestamptz,
  next_action_owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  note                 text CHECK (note IS NULL OR length(note) <= 10000),
  capture_source       text NOT NULL DEFAULT 'manual' CHECK (capture_source IN ('manual','card','qr','search','voice')),
  inbound_lead_id      uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  status               text NOT NULL DEFAULT 'completed' CHECK (status IN ('completed','cancelled')),
  client_updated_at    timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  updated_by           uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT booth_interactions_id_exhibitor_key UNIQUE (id, exhibitor_id),
  CONSTRAINT booth_interactions_workspace_fk
    FOREIGN KEY (workspace_id, exhibitor_id) REFERENCES public.booth_workspaces (id, exhibitor_id) ON DELETE RESTRICT,
  CONSTRAINT booth_interactions_contact_fk
    FOREIGN KEY (contact_id, exhibitor_id) REFERENCES public.booth_contacts (id, exhibitor_id) ON DELETE RESTRICT,
  CONSTRAINT booth_interactions_topic_only_customer CHECK (customer_topic IS NULL OR relationship = 'customer')
);
CREATE INDEX booth_interactions_workspace_idx ON public.booth_interactions (workspace_id, occurred_at DESC);
CREATE INDEX booth_interactions_contact_idx ON public.booth_interactions (contact_id, exhibitor_id);
CREATE INDEX booth_interactions_exhibitor_idx ON public.booth_interactions (exhibitor_id);
CREATE INDEX booth_interactions_owner_idx ON public.booth_interactions (owner_user_id);
CREATE INDEX booth_interactions_open_actions_idx ON public.booth_interactions (exhibitor_id, next_action_due)
  WHERE next_action <> 'none' AND next_action_done_at IS NULL AND status = 'completed';
CREATE INDEX booth_interactions_inbound_lead_idx ON public.booth_interactions (inbound_lead_id) WHERE inbound_lead_id IS NOT NULL;

-- 2.6 Opportunités
CREATE TABLE public.booth_opportunities (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id           uuid NOT NULL,
  exhibitor_id           uuid NOT NULL,
  contact_id             uuid NOT NULL,
  origin_interaction_id  uuid,
  title                  text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 300),
  value_band             text CHECK (value_band IS NULL OR value_band IN ('lt5k','5_20k','20_50k','50_100k','gt100k')),
  amount                 numeric(14,2) CHECK (amount IS NULL OR amount >= 0),
  currency               text NOT NULL DEFAULT 'EUR' CHECK (currency ~ '^[A-Z]{3}$'),
  horizon                text CHECK (horizon IS NULL OR horizon IN ('lt3m','3_6m','6_12m','gt12m')),
  probability            smallint CHECK (probability IS NULL OR probability IN (10,25,50,75,90)),
  status                 text NOT NULL DEFAULT 'open' CHECK (status IN ('open','won','lost','abandoned')),
  won_amount             numeric(14,2) CHECK (won_amount IS NULL OR won_amount >= 0),
  won_at                 timestamptz,
  lost_at                timestamptz,
  owner_user_id          uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by             uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  updated_by             uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT booth_opportunities_workspace_fk
    FOREIGN KEY (workspace_id, exhibitor_id) REFERENCES public.booth_workspaces (id, exhibitor_id) ON DELETE RESTRICT,
  CONSTRAINT booth_opportunities_contact_fk
    FOREIGN KEY (contact_id, exhibitor_id) REFERENCES public.booth_contacts (id, exhibitor_id) ON DELETE RESTRICT,
  CONSTRAINT booth_opportunities_origin_fk
    FOREIGN KEY (origin_interaction_id, exhibitor_id) REFERENCES public.booth_interactions (id, exhibitor_id) ON DELETE RESTRICT,
  CONSTRAINT booth_opportunities_won_coherent CHECK (status = 'won' OR (won_amount IS NULL AND won_at IS NULL))
);
CREATE INDEX booth_opportunities_workspace_idx ON public.booth_opportunities (workspace_id, status);
CREATE INDEX booth_opportunities_contact_idx ON public.booth_opportunities (contact_id, exhibitor_id);
CREATE INDEX booth_opportunities_exhibitor_idx ON public.booth_opportunities (exhibitor_id);
CREATE INDEX booth_opportunities_origin_idx ON public.booth_opportunities (origin_interaction_id, exhibitor_id) WHERE origin_interaction_id IS NOT NULL;
CREATE INDEX booth_opportunities_owner_idx ON public.booth_opportunities (owner_user_id);

-- Index des colonnes utilisateur (suppression d'un compte sans balayage complet)
CREATE INDEX booth_access_requested_by_idx ON public.booth_access (requested_by);
CREATE INDEX booth_access_reviewed_by_idx ON public.booth_access (reviewed_by);
CREATE INDEX booth_access_target_event_idx ON public.booth_access (target_event_id);
CREATE INDEX booth_team_members_invited_by_idx ON public.booth_team_members (invited_by);
CREATE INDEX booth_workspaces_created_by_idx ON public.booth_workspaces (created_by);
CREATE INDEX booth_contacts_created_by_idx ON public.booth_contacts (created_by);
CREATE INDEX booth_interactions_created_by_idx ON public.booth_interactions (created_by);
CREATE INDEX booth_interactions_updated_by_idx ON public.booth_interactions (updated_by);
CREATE INDEX booth_interactions_action_owner_idx ON public.booth_interactions (next_action_owner_id);
CREATE INDEX booth_opportunities_created_by_idx ON public.booth_opportunities (created_by);
CREATE INDEX booth_opportunities_updated_by_idx ON public.booth_opportunities (updated_by);

-- =========================================================================
-- 3. updated_at automatique
-- =========================================================================
CREATE OR REPLACE FUNCTION public.booth_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

CREATE TRIGGER booth_access_touch BEFORE UPDATE ON public.booth_access
  FOR EACH ROW EXECUTE FUNCTION public.booth_touch_updated_at();
CREATE TRIGGER booth_team_members_touch BEFORE UPDATE ON public.booth_team_members
  FOR EACH ROW EXECUTE FUNCTION public.booth_touch_updated_at();
CREATE TRIGGER booth_workspaces_touch BEFORE UPDATE ON public.booth_workspaces
  FOR EACH ROW EXECUTE FUNCTION public.booth_touch_updated_at();
CREATE TRIGGER booth_contacts_touch BEFORE UPDATE ON public.booth_contacts
  FOR EACH ROW EXECUTE FUNCTION public.booth_touch_updated_at();
CREATE TRIGGER booth_interactions_touch BEFORE UPDATE ON public.booth_interactions
  FOR EACH ROW EXECUTE FUNCTION public.booth_touch_updated_at();
CREATE TRIGGER booth_opportunities_touch BEFORE UPDATE ON public.booth_opportunities
  FOR EACH ROW EXECUTE FUNCTION public.booth_touch_updated_at();

-- =========================================================================
-- 4. Fonctions d'accès
-- =========================================================================
CREATE OR REPLACE FUNCTION public.booth_is_real_user()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL
     AND coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
$$;

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

  -- Accès bêta validé obligatoire pour tous les autres
  IF NOT EXISTS (SELECT 1 FROM public.booth_access a
                 WHERE a.exhibitor_id = _exhibitor_id AND a.status = 'approved') THEN
    RETURN NULL;
  END IF;

  -- Owner ou admin actif de la fiche : manager (lecture seule de exhibitor_team_members)
  IF EXISTS (SELECT 1 FROM public.exhibitor_team_members t
             WHERE t.exhibitor_id = _exhibitor_id AND t.user_id = _uid
               AND t.status = 'active' AND t.role IN ('owner','admin')) THEN
    RETURN 'manager';
  END IF;

  SELECT m.role INTO _role
  FROM public.booth_team_members m
  WHERE m.exhibitor_id = _exhibitor_id AND m.user_id = _uid AND m.status = 'active';

  RETURN _role;
END $$;

CREATE OR REPLACE FUNCTION public.booth_can_read(_exhibitor_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$ SELECT public.booth_role(_exhibitor_id) IS NOT NULL $$;

-- =========================================================================
-- 5. RLS : activée partout, lecture seule pour l'équipe sur 3 tables, aucune écriture directe
-- =========================================================================
ALTER TABLE public.booth_access        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booth_team_members  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booth_workspaces    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booth_contacts      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booth_interactions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booth_opportunities ENABLE ROW LEVEL SECURITY;

-- Tables lues uniquement via RPC (aucune policy, aucun privilège) : explicite pour l'advisor
CREATE POLICY booth_access_no_direct ON public.booth_access FOR SELECT TO authenticated USING (false);
CREATE POLICY booth_team_members_no_direct ON public.booth_team_members FOR SELECT TO authenticated USING (false);
CREATE POLICY booth_workspaces_no_direct ON public.booth_workspaces FOR SELECT TO authenticated USING (false);

CREATE POLICY booth_contacts_team_read ON public.booth_contacts
  FOR SELECT TO authenticated USING (public.booth_can_read(exhibitor_id));
CREATE POLICY booth_interactions_team_read ON public.booth_interactions
  FOR SELECT TO authenticated USING (public.booth_can_read(exhibitor_id));
CREATE POLICY booth_opportunities_team_read ON public.booth_opportunities
  FOR SELECT TO authenticated USING (public.booth_can_read(exhibitor_id));

-- =========================================================================
-- 6. Privilèges (les privilèges par défaut du schéma public donnent tout à anon : on retire)
-- =========================================================================
REVOKE ALL ON public.booth_access, public.booth_team_members, public.booth_workspaces,
              public.booth_contacts, public.booth_interactions, public.booth_opportunities
  FROM PUBLIC, anon, authenticated;

GRANT SELECT ON public.booth_contacts, public.booth_interactions, public.booth_opportunities TO authenticated;
GRANT ALL ON public.booth_access, public.booth_team_members, public.booth_workspaces,
             public.booth_contacts, public.booth_interactions, public.booth_opportunities TO service_role;

REVOKE ALL ON FUNCTION public.booth_enabled()               FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.booth_is_real_user()          FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.booth_role(uuid)              FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.booth_can_read(uuid)          FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.booth_touch_updated_at()      FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.booth_enabled()      TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.booth_is_real_user() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.booth_role(uuid)     TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.booth_can_read(uuid) TO authenticated, service_role;

COMMENT ON TABLE public.booth_access        IS 'Lotexpo Leads : demande et validation de l''accès bêta, une ligne par exposant.';
COMMENT ON TABLE public.booth_team_members  IS 'Lotexpo Leads : équipe commerciale (manager, field) de l''exposant. Ne jamais écrire dans exhibitor_team_members.';
COMMENT ON TABLE public.booth_workspaces    IS 'Lotexpo Leads : un exposant sur un salon. Coût lisible par les managers uniquement, via RPC.';
COMMENT ON TABLE public.booth_contacts      IS 'Lotexpo Leads : carnet de contacts privé de l''exposant.';
COMMENT ON TABLE public.booth_interactions  IS 'Lotexpo Leads : rencontres sur le stand, avec la prochaine action intégrée.';
COMMENT ON TABLE public.booth_opportunities IS 'Lotexpo Leads : opportunités commerciales issues des salons.';

NOTIFY pgrst, 'reload schema';
