-- Fix security vulnerability: Remove public read access to newsletter_subscriptions
-- This prevents hackers from stealing customer email addresses

-- Drop the existing public read policy that exposes all email addresses
DROP POLICY IF EXISTS "Allow public newsletter read for duplicates" ON public.newsletter_subscriptions;

-- Keep the existing INSERT and UPDATE policies for public newsletter subscription functionality
-- These are needed for the newsletter subscription form to work

-- Add admin-only read access for legitimate administration needs
CREATE POLICY "Admins can read newsletter subscriptions" 
ON public.newsletter_subscriptions 
FOR SELECT 
TO authenticated
USING (is_admin());

-- Add a service role policy for the newsletter-subscribe function to handle duplicates securely
CREATE POLICY "Service role can read for newsletter operations" 
ON public.newsletter_subscriptions 
FOR SELECT 
TO service_role
USING (true);