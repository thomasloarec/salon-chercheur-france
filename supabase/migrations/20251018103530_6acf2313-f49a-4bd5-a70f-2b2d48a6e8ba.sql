-- Fix RLS policy to match actual status values in database
DROP POLICY IF EXISTS "Public read access to published novelties" ON public.novelties;

CREATE POLICY "Public read access to published novelties"
ON public.novelties
FOR SELECT
USING (
  (status = 'published') 
  OR is_admin() 
  OR (EXISTS (
    SELECT 1 FROM exhibitors e 
    WHERE e.id = novelties.exhibitor_id 
    AND e.owner_user_id = auth.uid()
  ))
);