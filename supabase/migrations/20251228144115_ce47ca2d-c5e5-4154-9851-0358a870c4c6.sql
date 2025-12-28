
-- Mise à jour de la politique RLS pour novelties
-- Le problème est la référence circulaire avec la RLS des exhibitors

-- Supprimer l'ancienne politique
DROP POLICY IF EXISTS "Public read access to published novelties" ON public.novelties;

-- Recréer une politique plus simple sans référence au exhibitors.owner_user_id
-- pour permettre aux utilisateurs non connectés de voir les nouveautés publiées
CREATE POLICY "Public read access to published novelties" 
ON public.novelties 
FOR SELECT 
USING (
  -- Nouveautés publiées et non-test visibles par tous
  (status = 'published' AND is_test = false)
  -- Admins voient tout
  OR is_admin()
);
