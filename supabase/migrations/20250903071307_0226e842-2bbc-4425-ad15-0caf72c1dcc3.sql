-- FIX REMAINING SECURITY VULNERABILITIES
-- Lock down newsletter subscriptions, event sectors, application logs

-- 1. SECURE NEWSLETTER SUBSCRIPTIONS
DROP POLICY IF EXISTS "Allow public newsletter update" ON public.newsletter_subscriptions;
DROP POLICY IF EXISTS "Service role can read for newsletter operations" ON public.newsletter_subscriptions;

CREATE POLICY "Service role only newsletter update" 
ON public.newsletter_subscriptions 
FOR UPDATE 
USING (auth.role() = 'service_role');

CREATE POLICY "Service role newsletter read" 
ON public.newsletter_subscriptions 
FOR SELECT 
USING (auth.role() = 'service_role');

-- 2. SECURE EVENT SECTORS  
DROP POLICY IF EXISTS "Admins can insert event sectors" ON public.event_sectors;
DROP POLICY IF EXISTS "Admins can delete event sectors" ON public.event_sectors;

CREATE POLICY "Admin or service role can insert event sectors" 
ON public.event_sectors 
FOR INSERT 
WITH CHECK (is_admin() OR auth.role() = 'service_role');

CREATE POLICY "Admin or service role can delete event sectors" 
ON public.event_sectors 
FOR DELETE 
USING (is_admin() OR auth.role() = 'service_role');

-- 3. SECURE APPLICATION LOGS
DROP POLICY IF EXISTS "Service role can insert logs" ON public.application_logs;

CREATE POLICY "Service role only log insert" 
ON public.application_logs 
FOR INSERT 
WITH CHECK (auth.role() = 'service_role');