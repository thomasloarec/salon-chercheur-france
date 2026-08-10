-- BLOC 2 : RLS + revocation des grants sur les 12 tables publiques ouvertes.
-- Constat audit : anon et authenticated disposaient de SELECT/INSERT/UPDATE/
-- DELETE/TRUNCATE sans aucune RLS. Aucun acces direct depuis le front ni les
-- Edge Functions. Tous les acces legitimes passent par des RPC SECURITY
-- DEFINER, qui restent fonctionnelles.
-- Version idempotente : rejouable sans erreur.

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'growth_leads','growth_offer_config','growth_subscriptions',
    'event_profiles','event_recommendations','event_series','event_similarity',
    'event_snapshots','exhibitor_categories','recommendable_embeddings',
    'staging_organizer_exhibitors','taxonomy_categories'
  ] LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'admin_full_access_' || t, t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin())',
      'admin_full_access_' || t, t
    );
  END LOOP;
END $$;

