-- =====================================================================
-- Depreciation prudente de 4 RPC Radar mortes (etape 1 : revocation).
-- Vestiges de l'ancien ajout manuel d'entreprise et de la recherche
-- d'exposants, desactives depuis que le CRM est seule source de verite.
--
-- Verifie le 16/08/2026 : aucune de ces fonctions n'est appelee par le
-- front ni par une autre fonction SQL. Surfaces non verifiables depuis la
-- base (Edge Functions, workflows N8N) : on revoque au lieu de DROP pour
-- qu'un appelant oublie se manifeste par une erreur de permission claire
-- et reversible, plutot que par un plantage sur fonction disparue.
--
-- Applique en prod le 16/08/2026 via Supabase MCP, revocation confirmee.
--
-- ETAPE 2 (a faire plus tard, si rien ne s'est manifeste sous quelques
-- semaines) : DROP des 4 fonctions puis regeneration de types.ts.
-- Bloc DROP fourni en commentaire ci-dessous, NE PAS decommenter maintenant.
-- =====================================================================

revoke execute on function public.add_radar_manual_company(uuid, text, text) from authenticated, anon;
revoke execute on function public.add_radar_company_from_exposant(text, uuid) from authenticated, anon;
revoke execute on function public.search_radar_salon_exposants(uuid, text) from authenticated, anon;
revoke execute on function public.get_user_crm_matches(uuid) from authenticated, anon;

-- =====================================================================
-- ETAPE 2 — SUPPRESSION DEFINITIVE (ne pas activer avant la periode d'observation)
-- =====================================================================
-- drop function if exists public.add_radar_manual_company(uuid, text, text);
-- drop function if exists public.add_radar_company_from_exposant(text, uuid);
-- drop function if exists public.search_radar_salon_exposants(uuid, text);
-- drop function if exists public.get_user_crm_matches(uuid);
