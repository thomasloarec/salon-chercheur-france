
-- ============================================================
-- CHANTIER 1 : Vue exhibitors_public
-- ============================================================

-- Étape 1 : Créer la vue publique avec les 13 colonnes légitimes
CREATE OR REPLACE VIEW public.exhibitors_public AS
SELECT
  id,
  name,
  slug,
  website,
  logo_url,
  description,
  stand_info,
  plan,
  approved,
  owner_user_id,
  is_test,
  created_at,
  updated_at
FROM public.exhibitors;

-- Sécuriser la vue
ALTER VIEW public.exhibitors_public SET (security_barrier = true);

-- Donner accès en lecture à anon et authenticated via PostgREST
GRANT SELECT ON public.exhibitors_public TO anon;
GRANT SELECT ON public.exhibitors_public TO authenticated;

-- Étape 2 : Restreindre le SELECT sur la TABLE DE BASE
-- Supprimer l'ancienne policy SELECT publique
DROP POLICY "Public read access to exhibitors" ON public.exhibitors;

-- Nouveau SELECT : admin OU propriétaire uniquement
CREATE POLICY "Restricted read access to exhibitors"
ON public.exhibitors
FOR SELECT
TO public
USING (
  is_admin()
  OR (owner_user_id = auth.uid())
);

-- ============================================================
-- CHANTIER 2 : Storage novelty-resources ownership
-- ============================================================

-- Supprimer les policies UPDATE et DELETE trop permissives
DROP POLICY "Users can update their resources" ON storage.objects;
DROP POLICY "Users can delete their resources" ON storage.objects;

-- Recréer UPDATE : propriétaire de la nouveauté OU admin
CREATE POLICY "Owners can update their resources"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'novelty-resources'
  AND auth.uid() IS NOT NULL
  AND (
    public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.novelties n
      JOIN public.exhibitors e ON e.id = n.exhibitor_id
      WHERE n.id::text = (storage.foldername(name))[1]
        AND e.owner_user_id = auth.uid()
    )
  )
);

-- Recréer DELETE : même logique
CREATE POLICY "Owners can delete their resources"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'novelty-resources'
  AND auth.uid() IS NOT NULL
  AND (
    public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.novelties n
      JOIN public.exhibitors e ON e.id = n.exhibitor_id
      WHERE n.id::text = (storage.foldername(name))[1]
        AND e.owner_user_id = auth.uid()
    )
  )
);
