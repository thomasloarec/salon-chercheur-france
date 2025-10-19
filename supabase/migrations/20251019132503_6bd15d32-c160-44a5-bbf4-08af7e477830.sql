-- Fix infinite recursion in novelties UPDATE policy
-- Drop the problematic policy
DROP POLICY IF EXISTS "Exhibitor owners can update novelties except status" ON public.novelties;

-- Create a new, simpler policy that allows exhibitor owners to update their novelties
-- This allows them to update all fields including status (needed when modifications revert to draft)
CREATE POLICY "Exhibitor owners can update their novelties"
ON public.novelties
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM public.exhibitors e
    WHERE e.id = novelties.exhibitor_id 
      AND e.owner_user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM public.exhibitors e
    WHERE e.id = novelties.exhibitor_id 
      AND e.owner_user_id = auth.uid()
  )
);