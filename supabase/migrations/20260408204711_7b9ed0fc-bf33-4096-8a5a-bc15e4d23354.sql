
-- ============================================================
-- Phase 1: Exhibitor Team Members + Governance
-- ============================================================

-- 1. Create role enum
CREATE TYPE public.exhibitor_team_role AS ENUM ('owner', 'admin');

-- 2. Create status enum
CREATE TYPE public.exhibitor_team_status AS ENUM ('active', 'invited', 'removed');

-- 3. Create exhibitor_team_members table
CREATE TABLE public.exhibitor_team_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  exhibitor_id UUID NOT NULL REFERENCES public.exhibitors(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role exhibitor_team_role NOT NULL DEFAULT 'admin',
  status exhibitor_team_status NOT NULL DEFAULT 'active',
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (exhibitor_id, user_id)
);

-- 4. Partial unique index: one active owner per exhibitor
CREATE UNIQUE INDEX idx_one_active_owner_per_exhibitor
  ON public.exhibitor_team_members (exhibitor_id)
  WHERE role = 'owner' AND status = 'active';

-- 5. Performance indexes
CREATE INDEX idx_team_user ON public.exhibitor_team_members (user_id);
CREATE INDEX idx_team_exhibitor ON public.exhibitor_team_members (exhibitor_id);

-- 6. Enable RLS
ALTER TABLE public.exhibitor_team_members ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies (NO public read)

-- Users can see their own memberships
CREATE POLICY "Users can view their own memberships"
  ON public.exhibitor_team_members
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Active team members can see teammates
CREATE POLICY "Team members can view their teammates"
  ON public.exhibitor_team_members
  FOR SELECT
  TO authenticated
  USING (
    exhibitor_id IN (
      SELECT etm.exhibitor_id
      FROM public.exhibitor_team_members etm
      WHERE etm.user_id = auth.uid() AND etm.status = 'active'
    )
  );

-- Admins full access
CREATE POLICY "Admins can manage team members"
  ON public.exhibitor_team_members
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Service role full access
CREATE POLICY "Service role can manage team members"
  ON public.exhibitor_team_members
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 8. Add verified_at to exhibitors
ALTER TABLE public.exhibitors ADD COLUMN verified_at TIMESTAMPTZ;

-- 9. Update protect_exhibitor_columns: preserve ALL Phase 0 + add verified_at
CREATE OR REPLACE FUNCTION public.protect_exhibitor_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Admins can do anything
  IF public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  -- Service role bypass
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Lock sensitive columns for non-admins
  IF NEW.approved IS DISTINCT FROM OLD.approved THEN
    NEW.approved := OLD.approved;
  END IF;
  IF NEW.plan IS DISTINCT FROM OLD.plan THEN
    NEW.plan := OLD.plan;
  END IF;
  IF NEW.owner_user_id IS DISTINCT FROM OLD.owner_user_id THEN
    NEW.owner_user_id := OLD.owner_user_id;
  END IF;
  IF NEW.is_test IS DISTINCT FROM OLD.is_test THEN
    NEW.is_test := OLD.is_test;
  END IF;
  -- NEW: protect verified_at
  IF NEW.verified_at IS DISTINCT FROM OLD.verified_at THEN
    NEW.verified_at := OLD.verified_at;
  END IF;
  -- CRM / campaign columns (Phase 0 preserved)
  IF NEW.campaign_eligible IS DISTINCT FROM OLD.campaign_eligible THEN
    NEW.campaign_eligible := OLD.campaign_eligible;
  END IF;
  IF NEW.campaign_status IS DISTINCT FROM OLD.campaign_status THEN
    NEW.campaign_status := OLD.campaign_status;
  END IF;
  IF NEW.campaign_stop_reason IS DISTINCT FROM OLD.campaign_stop_reason THEN
    NEW.campaign_stop_reason := OLD.campaign_stop_reason;
  END IF;
  IF NEW.contact_email IS DISTINCT FROM OLD.contact_email THEN
    NEW.contact_email := OLD.contact_email;
  END IF;
  IF NEW.contact_prenom IS DISTINCT FROM OLD.contact_prenom THEN
    NEW.contact_prenom := OLD.contact_prenom;
  END IF;
  IF NEW.contact_poste IS DISTINCT FROM OLD.contact_poste THEN
    NEW.contact_poste := OLD.contact_poste;
  END IF;
  IF NEW.contact_score IS DISTINCT FROM OLD.contact_score THEN
    NEW.contact_score := OLD.contact_score;
  END IF;
  IF NEW.email_source IS DISTINCT FROM OLD.email_source THEN
    NEW.email_source := OLD.email_source;
  END IF;
  IF NEW.hunter_search_done IS DISTINCT FROM OLD.hunter_search_done THEN
    NEW.hunter_search_done := OLD.hunter_search_done;
  END IF;
  IF NEW.hunter_verify_done IS DISTINCT FROM OLD.hunter_verify_done THEN
    NEW.hunter_verify_done := OLD.hunter_verify_done;
  END IF;
  IF NEW.pre_hunter_score IS DISTINCT FROM OLD.pre_hunter_score THEN
    NEW.pre_hunter_score := OLD.pre_hunter_score;
  END IF;
  IF NEW.company_tier IS DISTINCT FROM OLD.company_tier THEN
    NEW.company_tier := OLD.company_tier;
  END IF;
  IF NEW.company_size_signal IS DISTINCT FROM OLD.company_size_signal THEN
    NEW.company_size_signal := OLD.company_size_signal;
  END IF;
  IF NEW.is_generic_inbox IS DISTINCT FROM OLD.is_generic_inbox THEN
    NEW.is_generic_inbox := OLD.is_generic_inbox;
  END IF;
  IF NEW.opt_out IS DISTINCT FROM OLD.opt_out THEN
    NEW.opt_out := OLD.opt_out;
  END IF;
  IF NEW.current_step IS DISTINCT FROM OLD.current_step THEN
    NEW.current_step := OLD.current_step;
  END IF;
  IF NEW.last_sent_at IS DISTINCT FROM OLD.last_sent_at THEN
    NEW.last_sent_at := OLD.last_sent_at;
  END IF;
  IF NEW.next_send_date IS DISTINCT FROM OLD.next_send_date THEN
    NEW.next_send_date := OLD.next_send_date;
  END IF;
  IF NEW.reply_status IS DISTINCT FROM OLD.reply_status THEN
    NEW.reply_status := OLD.reply_status;
  END IF;
  IF NEW.reply_date IS DISTINCT FROM OLD.reply_date THEN
    NEW.reply_date := OLD.reply_date;
  END IF;
  IF NEW.outlook_conv_id IS DISTINCT FROM OLD.outlook_conv_id THEN
    NEW.outlook_conv_id := OLD.outlook_conv_id;
  END IF;
  IF NEW.outlook_message_id IS DISTINCT FROM OLD.outlook_message_id THEN
    NEW.outlook_message_id := OLD.outlook_message_id;
  END IF;

  RETURN NEW;
END;
$$;

-- 10. Sync trigger: exhibitor_team_members → exhibitors.owner_user_id (unidirectional)
CREATE OR REPLACE FUNCTION public.sync_team_to_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _exhibitor_id UUID;
  _new_owner UUID;
BEGIN
  -- Determine which exhibitor was affected
  IF TG_OP = 'DELETE' THEN
    _exhibitor_id := OLD.exhibitor_id;
  ELSE
    _exhibitor_id := NEW.exhibitor_id;
  END IF;

  -- Find the current active owner
  SELECT user_id INTO _new_owner
  FROM public.exhibitor_team_members
  WHERE exhibitor_id = _exhibitor_id
    AND role = 'owner'
    AND status = 'active'
  LIMIT 1;

  -- Update exhibitors.owner_user_id (bypasses protect trigger via SECURITY DEFINER)
  UPDATE public.exhibitors
  SET owner_user_id = _new_owner,
      updated_at = now()
  WHERE id = _exhibitor_id
    AND (owner_user_id IS DISTINCT FROM _new_owner);

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_team_to_owner
  AFTER INSERT OR UPDATE OR DELETE
  ON public.exhibitor_team_members
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_team_to_owner();

-- 11. Updated_at trigger for exhibitor_team_members
CREATE TRIGGER update_team_members_updated_at
  BEFORE UPDATE ON public.exhibitor_team_members
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 12. Seed data: migrate existing owner_user_id entries
INSERT INTO public.exhibitor_team_members (exhibitor_id, user_id, role, status)
SELECT id, owner_user_id, 'owner', 'active'
FROM public.exhibitors
WHERE owner_user_id IS NOT NULL
ON CONFLICT (exhibitor_id, user_id) DO NOTHING;

-- 13. Set verified_at for exhibitors that have an owner
UPDATE public.exhibitors
SET verified_at = now()
WHERE owner_user_id IS NOT NULL AND verified_at IS NULL;
