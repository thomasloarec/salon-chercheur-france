
-- Phase 3 Bloc C: Security functions + RLS migration to team_members

-- 1. Create is_team_member function
CREATE OR REPLACE FUNCTION public.is_team_member(_exhibitor_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.exhibitor_team_members
    WHERE exhibitor_id = _exhibitor_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin')
      AND status = 'active'
  )
$$;

-- 2. Create has_active_owner function
CREATE OR REPLACE FUNCTION public.has_active_owner(_exhibitor_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.exhibitor_team_members
    WHERE exhibitor_id = _exhibitor_id
      AND role = 'owner'
      AND status = 'active'
  )
$$;

-- 3. Novelties UPDATE: replace owner_user_id with is_team_member
DROP POLICY IF EXISTS "Exhibitor owners can update their novelties" ON public.novelties;
CREATE POLICY "Team members can update their novelties"
  ON public.novelties
  FOR UPDATE
  TO authenticated
  USING (is_team_member(exhibitor_id))
  WITH CHECK (is_team_member(exhibitor_id));

-- 4. Leads SELECT: replace owner_user_id subquery with is_team_member
DROP POLICY IF EXISTS "Exhibitor owners can view their leads" ON public.leads;
CREATE POLICY "Team members can view their leads"
  ON public.leads
  FOR SELECT
  TO authenticated
  USING (
    is_team_member(exhibitor_id)
    OR (novelty_id IN (SELECT n.id FROM novelties n WHERE n.created_by = auth.uid()))
  );

-- 5. Leads UPDATE: replace owner_user_id subquery, add symmetric WITH CHECK
DROP POLICY IF EXISTS "Exhibitor owners can update their leads" ON public.leads;
CREATE POLICY "Team members can update their leads"
  ON public.leads
  FOR UPDATE
  TO authenticated
  USING (is_team_member(exhibitor_id) OR is_admin())
  WITH CHECK (is_team_member(exhibitor_id) OR is_admin());

-- 6. Novelty images: replace owner_user_id join, add symmetric WITH CHECK
DROP POLICY IF EXISTS "Exhibitor owners can manage their novelty images" ON public.novelty_images;
CREATE POLICY "Team members can manage their novelty images"
  ON public.novelty_images
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM novelties n
      WHERE n.id = novelty_images.novelty_id
        AND (is_team_member(n.exhibitor_id) OR is_admin())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM novelties n
      WHERE n.id = novelty_images.novelty_id
        AND (is_team_member(n.exhibitor_id) OR is_admin())
    )
  );

-- Also drop the legacy "Novelty creators can view their leads" policy
-- since the new "Team members can view their leads" already includes created_by check
DROP POLICY IF EXISTS "Novelty creators can view their leads" ON public.leads;
