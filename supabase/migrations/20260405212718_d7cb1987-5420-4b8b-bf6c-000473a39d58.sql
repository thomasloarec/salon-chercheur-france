-- ============================================================
-- Fix SECURITY DEFINER views: set security_invoker = true
-- ============================================================

-- 1. exhibitors_public: currently SECURITY DEFINER (bypasses RLS on exhibitors)
-- Fix: make it respect caller's permissions
ALTER VIEW public.exhibitors_public SET (security_invoker = true);

-- 2. exposants_a_enrichir: currently SECURITY DEFINER (low risk, consistency fix)
ALTER VIEW public.exposants_a_enrichir SET (security_invoker = true, security_barrier = true);