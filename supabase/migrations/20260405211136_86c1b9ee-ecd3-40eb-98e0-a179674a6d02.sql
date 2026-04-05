
-- ============================================================
-- CORRECTION : Restaurer le SELECT public et utiliser column-level security
-- ============================================================

-- 1. Supprimer la policy restrictive qu'on vient de créer
DROP POLICY IF EXISTS "Restricted read access to exhibitors" ON public.exhibitors;

-- 2. Restaurer la policy SELECT publique originale
CREATE POLICY "Public read access to exhibitors"
ON public.exhibitors
FOR SELECT
TO public
USING (
  is_admin()
  OR (
    (is_test = false)
    AND (
      (approved = true)
      OR (approved IS NULL)
      OR (EXISTS (
        SELECT 1 FROM novelties n
        WHERE n.exhibitor_id = exhibitors.id
          AND n.status = 'published'
          AND n.is_test = false
      ))
    )
  )
);

-- 3. Révoquer le SELECT global sur la table pour anon et authenticated
REVOKE SELECT ON public.exhibitors FROM anon;
REVOKE SELECT ON public.exhibitors FROM authenticated;

-- 4. Accorder le SELECT uniquement sur les colonnes sûres
GRANT SELECT (
  id, name, slug, website, logo_url, description, stand_info,
  plan, approved, owner_user_id, is_test, created_at, updated_at
) ON public.exhibitors TO anon;

GRANT SELECT (
  id, name, slug, website, logo_url, description, stand_info,
  plan, approved, owner_user_id, is_test, created_at, updated_at
) ON public.exhibitors TO authenticated;
