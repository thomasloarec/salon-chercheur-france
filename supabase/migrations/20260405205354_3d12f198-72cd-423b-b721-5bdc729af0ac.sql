-- Drop the overly permissive ALL policy that allows self-upgrade
DROP POLICY IF EXISTS "Users can manage their own plan" ON public.plans;

-- Drop duplicate SELECT policy (we'll recreate a clean one)
DROP POLICY IF EXISTS "Users can view their own plan" ON public.plans;

-- Users can only READ their own plan
CREATE POLICY "Users can view their own plan"
ON public.plans
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Only admins and service_role can modify plans
CREATE POLICY "Service role can manage plans"
ON public.plans
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
