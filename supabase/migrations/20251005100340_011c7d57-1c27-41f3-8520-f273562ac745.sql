-- Enable RLS on leads table if not already enabled
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any (to avoid conflicts)
DROP POLICY IF EXISTS "Novelty creators can view their leads" ON leads;
DROP POLICY IF EXISTS "Exhibitor owners can view their leads" ON leads;
DROP POLICY IF EXISTS "Admins can view all leads" ON leads;
DROP POLICY IF EXISTS "Service role can insert leads" ON leads;

-- Policy: Novelty creators can view their leads
CREATE POLICY "Novelty creators can view their leads"
ON leads FOR SELECT
USING (
  novelty_id IN (
    SELECT id FROM novelties WHERE created_by = auth.uid()
  )
);

-- Policy: Exhibitor owners can view leads for their novelties
CREATE POLICY "Exhibitor owners can view their leads"
ON leads FOR SELECT
USING (
  novelty_id IN (
    SELECT n.id FROM novelties n
    JOIN exhibitors e ON e.id = n.exhibitor_id
    WHERE e.owner_user_id = auth.uid()
  )
);

-- Policy: Admins can view all leads
CREATE POLICY "Admins can view all leads"
ON leads FOR SELECT
USING (is_admin());

-- Policy: Service role can insert leads
CREATE POLICY "Service role can insert leads"
ON leads FOR INSERT
WITH CHECK (auth.role() = 'service_role');