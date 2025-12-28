-- Mise à jour de la politique RLS pour exhibitors
-- Autoriser la lecture des exhibitors qui ont des novelties publiées même si approved = false

DROP POLICY IF EXISTS "Public read access to exhibitors" ON public.exhibitors;

CREATE POLICY "Public read access to exhibitors" 
ON public.exhibitors 
FOR SELECT 
USING (
  -- Admins peuvent tout voir
  is_admin()
  OR (
    -- Pas de test exhibitors pour les utilisateurs normaux
    is_test = false
    AND (
      -- Exhibitors approuvés ou sans statut
      approved = true 
      OR approved IS NULL
      -- OU exhibitors avec au moins une nouveauté publiée
      OR EXISTS (
        SELECT 1 FROM public.novelties n 
        WHERE n.exhibitor_id = exhibitors.id 
        AND n.status = 'published'
        AND n.is_test = false
      )
    )
  )
);