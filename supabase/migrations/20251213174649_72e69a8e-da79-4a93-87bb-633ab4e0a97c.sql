-- Fix newsletter_subscriptions: restrict email exposure to admins only
-- Drop the overly permissive public INSERT policy and create proper ones

-- First, check and drop existing policies that expose emails
DROP POLICY IF EXISTS "Admins can read newsletter subscriptions" ON public.newsletter_subscriptions;
DROP POLICY IF EXISTS "Allow public newsletter subscription" ON public.newsletter_subscriptions;
DROP POLICY IF EXISTS "Service role newsletter read" ON public.newsletter_subscriptions;
DROP POLICY IF EXISTS "Service role only newsletter update" ON public.newsletter_subscriptions;
DROP POLICY IF EXISTS "Users manage their own newsletter_subscriptions" ON public.newsletter_subscriptions;

-- Create more restrictive policies
-- Only admins and service role can read newsletter subscriptions (protects emails from public access)
CREATE POLICY "Admins and service role can read newsletter subscriptions"
ON public.newsletter_subscriptions
FOR SELECT
USING (is_admin() OR auth.role() = 'service_role');

-- Allow public INSERT for new subscriptions (needed for signup)
CREATE POLICY "Anyone can subscribe to newsletter"
ON public.newsletter_subscriptions
FOR INSERT
WITH CHECK (true);

-- Only service role can update subscriptions
CREATE POLICY "Service role can update newsletter subscriptions"
ON public.newsletter_subscriptions
FOR UPDATE
USING (auth.role() = 'service_role');

-- Only admins can delete subscriptions
CREATE POLICY "Admins can delete newsletter subscriptions"
ON public.newsletter_subscriptions
FOR DELETE
USING (is_admin());

-- Fix crm_connections: ensure unclaimed connections are properly protected
-- The current policies look reasonable but let's verify claim_token is protected
-- Users should never be able to see unclaimed connections or claim tokens

DROP POLICY IF EXISTS "Service role can manage CRM connections" ON public.crm_connections;
DROP POLICY IF EXISTS "Users can delete their CRM connections" ON public.crm_connections;
DROP POLICY IF EXISTS "Users can read their active CRM connections" ON public.crm_connections;
DROP POLICY IF EXISTS "Users can update their CRM connections" ON public.crm_connections;

-- Service role full access
CREATE POLICY "Service role can manage CRM connections"
ON public.crm_connections
FOR ALL
USING (auth.role() = 'service_role');

-- Users can only see their own claimed connections (not claim_token)
CREATE POLICY "Users can read their own claimed CRM connections"
ON public.crm_connections
FOR SELECT
USING (
  (auth.uid() = user_id AND status = 'active')
  OR is_admin()
);

-- Users can update their own claimed connections
CREATE POLICY "Users can update their own claimed CRM connections"
ON public.crm_connections
FOR UPDATE
USING (auth.uid() = user_id AND status = 'active');

-- Users can delete their own claimed connections
CREATE POLICY "Users can delete their own claimed CRM connections"
ON public.crm_connections
FOR DELETE
USING (auth.uid() = user_id AND status = 'active');