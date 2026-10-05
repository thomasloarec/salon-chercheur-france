-- Lotexpo Leads, Lot 1 bis : zéro accès direct aux tables booth_ depuis l'API.
-- Toutes les lectures et écritures passeront par des RPC (lots 3 et 4).

REVOKE SELECT ON public.booth_contacts, public.booth_interactions, public.booth_opportunities FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.booth_role(uuid)     FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.booth_can_read(uuid) FROM authenticated;

-- Policies réservées au service_role (aucune pour authenticated ou anon)
ALTER POLICY booth_access_no_direct        ON public.booth_access        TO service_role USING (true);
ALTER POLICY booth_team_members_no_direct  ON public.booth_team_members  TO service_role USING (true);
ALTER POLICY booth_workspaces_no_direct    ON public.booth_workspaces    TO service_role USING (true);
ALTER POLICY booth_contacts_team_read      ON public.booth_contacts      TO service_role USING (true);
ALTER POLICY booth_interactions_team_read  ON public.booth_interactions  TO service_role USING (true);
ALTER POLICY booth_opportunities_team_read ON public.booth_opportunities TO service_role USING (true);

ALTER POLICY booth_access_no_direct        ON public.booth_access        RENAME TO booth_access_service_only;
ALTER POLICY booth_team_members_no_direct  ON public.booth_team_members  RENAME TO booth_team_members_service_only;
ALTER POLICY booth_workspaces_no_direct    ON public.booth_workspaces    RENAME TO booth_workspaces_service_only;
ALTER POLICY booth_contacts_team_read      ON public.booth_contacts      RENAME TO booth_contacts_service_only;
ALTER POLICY booth_interactions_team_read  ON public.booth_interactions  RENAME TO booth_interactions_service_only;
ALTER POLICY booth_opportunities_team_read ON public.booth_opportunities RENAME TO booth_opportunities_service_only;

NOTIFY pgrst, 'reload schema';
