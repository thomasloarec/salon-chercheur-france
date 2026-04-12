DROP POLICY IF EXISTS "Public read access to exhibitors" ON public.exhibitors;

CREATE POLICY "Public read access to exhibitors"
ON public.exhibitors
FOR SELECT
USING (
  is_admin()
  OR is_team_member(id)
  OR (
    is_test = false
    AND (
      approved = true
      OR approved IS NULL
      OR EXISTS (
        SELECT 1 FROM novelties n
        WHERE n.exhibitor_id = exhibitors.id
          AND n.status = 'published'
          AND n.is_test = false
      )
    )
  )
);