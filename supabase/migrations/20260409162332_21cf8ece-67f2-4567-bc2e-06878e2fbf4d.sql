-- Fix missing GRANT on exhibitor_team_members
GRANT SELECT ON public.exhibitor_team_members TO authenticated, anon;
GRANT INSERT, UPDATE, DELETE ON public.exhibitor_team_members TO authenticated;
