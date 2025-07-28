-- Migration: Fix SECURITY DEFINER functions search_path
-- This migration addresses critical security vulnerability by ensuring all SECURITY DEFINER functions
-- have a secure search_path set to 'public'

DO $$
DECLARE
    func_record RECORD;
    func_count INTEGER := 0;
    updated_count INTEGER := 0;
BEGIN
    -- Log start of migration
    RAISE NOTICE 'Starting SECURITY DEFINER functions search_path fix migration...';
    
    -- Count total SECURITY DEFINER functions in public schema
    SELECT COUNT(*) INTO func_count
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' 
    AND p.prosecdef = true;
    
    RAISE NOTICE 'Found % SECURITY DEFINER functions in public schema', func_count;
    
    -- Process each SECURITY DEFINER function in public schema
    FOR func_record IN
        SELECT 
            p.proname as function_name,
            pg_get_function_identity_arguments(p.oid) as function_args,
            p.oid as function_oid,
            CASE 
                WHEN p.proconfig IS NULL THEN 'No config'
                ELSE array_to_string(p.proconfig, ', ')
            END as current_config
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public' 
        AND p.prosecdef = true
        ORDER BY p.proname
    LOOP
        RAISE NOTICE 'Processing function: %(%) - Current config: %', 
            func_record.function_name, 
            func_record.function_args,
            func_record.current_config;
        
        -- Check if search_path is already properly set
        IF func_record.current_config LIKE '%search_path=public%' OR 
           func_record.current_config LIKE '%search_path = public%' THEN
            RAISE NOTICE '  -> Already has secure search_path, skipping';
        ELSE
            -- Apply the security fix
            BEGIN
                EXECUTE format('ALTER FUNCTION public.%I(%s) SECURITY DEFINER SET search_path = public',
                    func_record.function_name,
                    func_record.function_args
                );
                
                updated_count := updated_count + 1;
                RAISE NOTICE '  -> ✓ Updated search_path to public';
                
            EXCEPTION WHEN OTHERS THEN
                RAISE WARNING '  -> ✗ Failed to update function %: %', 
                    func_record.function_name, SQLERRM;
            END;
        END IF;
    END LOOP;
    
    RAISE NOTICE 'Migration completed: % functions updated out of % total', updated_count, func_count;
END $$;

-- Final verification: Check for any remaining SECURITY DEFINER functions without secure search_path
DO $$
DECLARE
    insecure_count INTEGER := 0;
    func_record RECORD;
BEGIN
    RAISE NOTICE 'Performing final security verification...';
    
    -- Count functions that are SECURITY DEFINER but don't have search_path=public
    FOR func_record IN
        SELECT 
            p.proname as function_name,
            pg_get_function_identity_arguments(p.oid) as function_args,
            CASE 
                WHEN p.proconfig IS NULL THEN 'No config'
                ELSE array_to_string(p.proconfig, ', ')
            END as current_config
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public' 
        AND p.prosecdef = true
        AND (p.proconfig IS NULL OR 
             NOT (array_to_string(p.proconfig, ' ') LIKE '%search_path=public%' OR
                  array_to_string(p.proconfig, ' ') LIKE '%search_path = public%'))
    LOOP
        insecure_count := insecure_count + 1;
        RAISE WARNING 'SECURITY RISK: Function %.%(%) still has insecure search_path: %',
            'public',
            func_record.function_name,
            func_record.function_args,
            func_record.current_config;
    END LOOP;
    
    IF insecure_count = 0 THEN
        RAISE NOTICE '✓ SECURITY VERIFICATION PASSED: All SECURITY DEFINER functions have secure search_path';
    ELSE
        RAISE WARNING '✗ SECURITY VERIFICATION FAILED: % functions still have insecure search_path', insecure_count;
    END IF;
    
    -- Also show a summary of all SECURITY DEFINER functions for verification
    RAISE NOTICE 'Summary of all SECURITY DEFINER functions in public schema:';
    FOR func_record IN
        SELECT 
            p.proname as function_name,
            pg_get_function_identity_arguments(p.oid) as function_args,
            CASE 
                WHEN p.proconfig IS NULL THEN 'No config'
                ELSE array_to_string(p.proconfig, ', ')
            END as current_config
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public' 
        AND p.prosecdef = true
        ORDER BY p.proname
    LOOP
        RAISE NOTICE '  - %(%) -> %',
            func_record.function_name,
            func_record.function_args,
            func_record.current_config;
    END LOOP;
END $$;