-- Fix: Replace recursive RLS policy on exhibitor_team_members
-- The "Team members can view their teammates" policy queries the same table,
-- causing infinite recursion and 500 errors.

-- Drop the problematic recursive policy
DROP POLICY IF EXISTS "Team members can view their teammates" ON public.exhibitor_team_members;

-- Replace with a non-recursive version using the SECURITY DEFINER function
CREATE POLICY "Team members can view their teammates"
ON public.exhibitor_team_members
FOR SELECT
TO authenticated
USING (
  public.is_team_member(exhibitor_id)
);