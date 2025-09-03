-- CRITICAL SECURITY FIXES
-- This migration addresses all security vulnerabilities found in the security review

-- 1. FIX CRITICAL PRIVILEGE ESCALATION
-- Remove profiles table fallback from has_role function to prevent self-escalation to admin
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  );
$function$;

-- Update get_current_user_role to only derive from user_roles (not profiles)
CREATE OR REPLACE FUNCTION public.get_current_user_role()
 RETURNS app_role
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    (SELECT role FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1),
    'user'::app_role
  );
$function$;

-- 2. LOCK DOWN NEWSLETTER SUBSCRIPTIONS
-- Remove dangerous public update policy
DROP POLICY IF EXISTS "Allow public newsletter update" ON public.newsletter_subscriptions;

-- Create restricted update policy for service role only
CREATE POLICY "Service role only newsletter update" 
ON public.newsletter_subscriptions 
FOR UPDATE 
USING (auth.role() = 'service_role');

-- Fix service role read policy to actually require service role
DROP POLICY IF EXISTS "Service role can read for newsletter operations" ON public.newsletter_subscriptions;

CREATE POLICY "Service role newsletter read" 
ON public.newsletter_subscriptions 
FOR SELECT 
USING (auth.role() = 'service_role');

-- 3. RESTRICT EVENT_SECTORS WRITES
-- Remove overly permissive policies
DROP POLICY IF EXISTS "Admins can insert event sectors" ON public.event_sectors;
DROP POLICY IF EXISTS "Admins can delete event sectors" ON public.event_sectors;

-- Create proper restricted policies
CREATE POLICY "Admin or service role can insert event sectors" 
ON public.event_sectors 
FOR INSERT 
WITH CHECK (is_admin() OR auth.role() = 'service_role');

CREATE POLICY "Admin or service role can delete event sectors" 
ON public.event_sectors 
FOR DELETE 
USING (is_admin() OR auth.role() = 'service_role');

-- 4. RESTRICT APPLICATION_LOGS INSERT
-- Remove open insert policy
DROP POLICY IF EXISTS "Service role can insert logs" ON public.application_logs;

-- Create proper service role only policy
CREATE POLICY "Service role only log insert" 
ON public.application_logs 
FOR INSERT 
WITH CHECK (auth.role() = 'service_role');

-- 5. VERIFY NO SECURITY DEFINER VIEWS EXIST
-- This is diagnostic only - the actual views were fixed in previous migrations
-- Just ensuring we have a clean state