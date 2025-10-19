-- RLS Policy: Lock status column from client updates (only Edge Function with service role can update)

-- Drop ALL existing policies on novelties to start fresh
DROP POLICY IF EXISTS "Exhibitor owners can manage their novelties" ON novelties;
DROP POLICY IF EXISTS "Exhibitor owners can update novelties except status" ON novelties;
DROP POLICY IF EXISTS "Users can update their novelties" ON novelties;
DROP POLICY IF EXISTS "Novelty creators can update except status" ON novelties;
DROP POLICY IF EXISTS "Admins can manage all novelties" ON novelties;
DROP POLICY IF EXISTS "Public read access to published novelties" ON novelties;

-- Policy 1: Public read access to published novelties (or admins/owners for drafts)
CREATE POLICY "Public read access to published novelties"
ON novelties
FOR SELECT
USING (
  status = 'published' 
  OR is_admin() 
  OR EXISTS (
    SELECT 1 FROM exhibitors e
    WHERE e.id = novelties.exhibitor_id
    AND e.owner_user_id = auth.uid()
  )
);

-- Policy 2: Allow exhibitor owners to update their novelties EXCEPT status column
CREATE POLICY "Exhibitor owners can update novelties except status"
ON novelties
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM exhibitors e
    WHERE e.id = novelties.exhibitor_id
    AND e.owner_user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM exhibitors e
    WHERE e.id = novelties.exhibitor_id
    AND e.owner_user_id = auth.uid()
  )
  -- Prevent status modification from client: status must remain unchanged
  AND status = (SELECT status FROM novelties WHERE id = novelties.id)
);

-- Policy 3: Allow admins full access (they should use Edge Function for status updates)
CREATE POLICY "Admins can manage all novelties"
ON novelties
FOR ALL
USING (is_admin())
WITH CHECK (is_admin());

-- Add comment to document the security pattern
COMMENT ON TABLE novelties IS 'Status column updates must go through novelties-moderate Edge Function with service role to bypass RLS and ensure proper admin verification';
