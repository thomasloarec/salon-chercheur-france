-- Fix the function without proper search_path setting
-- This addresses the "Function Search Path Mutable" security warning

ALTER FUNCTION public.update_updated_at_column() 
SET search_path = 'public';

-- Also check and fix any other security issues we might have missed
-- Query to see all views and materialized views that could have SECURITY DEFINER
-- (This is just for diagnostic purposes, the actual fix is above)