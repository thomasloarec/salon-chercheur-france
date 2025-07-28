-- Vérification des paramètres d'authentification actuels
-- Note: Cette requête vérifie les paramètres accessibles via SQL

DO $$
BEGIN
    RAISE NOTICE 'Vérification des paramètres d''authentification Supabase...';
    
    -- Vérifier les paramètres auth accessibles
    RAISE NOTICE 'Configuration auth actuelle:';
    RAISE NOTICE '- Databases schema auth tables présentes: %', 
        (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'auth');
    
    -- Vérifier si l'extension auth est bien configurée
    RAISE NOTICE '- Extensions auth installées: %', 
        (SELECT string_agg(extname, ', ') FROM pg_extension WHERE extname LIKE '%auth%');
        
    -- Note importante pour l'utilisateur
    RAISE NOTICE '';
    RAISE NOTICE '⚠️  IMPORTANT: Les paramètres OTP_EXPIRATION et ENABLE_LEAKED_PASSWORD_PROTECTION';
    RAISE NOTICE '    ne peuvent être modifiés que via le dashboard Supabase:';
    RAISE NOTICE '    https://supabase.com/dashboard/project/vxivdvzzhebobveedxbj/auth/settings';
    RAISE NOTICE '';
    RAISE NOTICE '📋 Configuration recommandée:';
    RAISE NOTICE '    - OTP Expiry: 600 seconds (10 minutes)';
    RAISE NOTICE '    - Enable leaked password protection: ✓ Activé';
    
END $$;