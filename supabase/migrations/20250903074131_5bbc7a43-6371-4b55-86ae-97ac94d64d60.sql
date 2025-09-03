-- COMPREHENSIVE SECURITY FIXES
-- Fix database-level security issues and clear remaining warnings

-- 1. FIX SECURITY DEFINER VIEW WARNING (events_geo)
-- Recreate the view without SECURITY DEFINER to clear linter warning
DROP VIEW IF EXISTS public.events_geo CASCADE;

CREATE VIEW public.events_geo 
WITH (security_barrier = true) AS
SELECT 
  e.id,
  LEFT(e.code_postal, 2) as dep_code,
  e.code_postal,
  d.region_code
FROM public.events e
LEFT JOIN public.departements d ON LEFT(e.code_postal, 2) = d.code
WHERE e.visible = true;

-- Grant appropriate permissions
GRANT SELECT ON public.events_geo TO anon, authenticated;

-- 2. REDUCE PII IN ALERTS TABLE  
-- Deprecate user_email column to reduce PII sprawl
ALTER TABLE public.alerts DROP COLUMN IF EXISTS user_email;

-- 3. ADD NEWSLETTER ABUSE PROTECTION
-- Add simple abuse protection columns for newsletter subscriptions
ALTER TABLE public.newsletter_subscriptions 
ADD COLUMN IF NOT EXISTS ip_address inet,
ADD COLUMN IF NOT EXISTS subscription_count integer DEFAULT 1,
ADD COLUMN IF NOT EXISTS verified boolean DEFAULT false;

-- Create index for abuse monitoring
CREATE INDEX IF NOT EXISTS idx_newsletter_ip_created 
ON public.newsletter_subscriptions(ip_address, created_at);

-- Update existing records
UPDATE public.newsletter_subscriptions 
SET verified = true 
WHERE verified IS NULL;

-- 4. SECURITY MONITORING TABLE
-- Create table for security event logging
CREATE TABLE IF NOT EXISTS public.security_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  user_id uuid,
  ip_address inet,
  user_agent text,
  details jsonb,
  severity text CHECK (severity IN ('info', 'warning', 'error', 'critical')),
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;

-- Only service role can manage security events
CREATE POLICY "Service role can manage security events" 
ON public.security_events 
FOR ALL 
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Admins can read security events
CREATE POLICY "Admins can read security events" 
ON public.security_events 
FOR SELECT 
USING (is_admin());