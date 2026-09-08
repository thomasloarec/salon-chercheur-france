-- =====================================================================
-- Lot B (3/5) : Supabase accorde EXECUTE a PUBLIC sur toute fonction
-- nouvellement creee. Un GRANT nominatif a authenticated ne suffit donc
-- pas a fermer l'acces : il faut revoquer PUBLIC et anon explicitement.
-- Ces fonctions levent deja 'not_authenticated', la correction porte sur
-- la surface exposee, pas sur un contournement possible.
-- Applique en prod le 08/09/2026 via Supabase MCP.
-- =====================================================================

revoke execute on function public.search_radar_salon_exposants(uuid, text) from public, anon;
revoke execute on function public.add_radar_terrain_encounter(uuid, text, text) from public, anon;
revoke execute on function public.radar_manual_import_id(uuid) from public, anon;
revoke execute on function public.radar_company_in_veille(uuid, uuid, text) from public, anon;
