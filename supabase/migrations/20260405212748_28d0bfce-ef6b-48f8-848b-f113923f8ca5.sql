-- ============================================================
-- Fix remaining SECURITY DEFINER views
-- ============================================================
-- CONTEXT: v_a_enrichir and v_exposants_eligibles read from outreach_campaigns
-- which has RLS restricted to service_role only.
-- These views are NOT used from frontend or Edge Functions (verified by codebase search).
-- In security_invoker mode, they will return 0 rows for non-service_role callers,
-- which is the intended behavior (admin-only usage via Supabase Studio).
-- ============================================================

ALTER VIEW public.v_a_enrichir SET (security_invoker = true, security_barrier = true);
ALTER VIEW public.v_exposants_eligibles SET (security_invoker = true, security_barrier = true);