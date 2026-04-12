
-- Révoquer l'accès anon aux colonnes sensibles de profiles
-- (on conserve id, user_id, first_name, last_name, avatar_url pour les commentaires publics)

REVOKE SELECT ON public.profiles FROM anon;

-- Re-GRANT uniquement les colonnes publiques nécessaires pour anon
GRANT SELECT (id, user_id, first_name, last_name, avatar_url) ON public.profiles TO anon;

-- S'assurer que authenticated garde un accès complet
GRANT SELECT ON public.profiles TO authenticated;
