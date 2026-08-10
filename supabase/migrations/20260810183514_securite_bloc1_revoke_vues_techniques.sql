-- BLOC 1 : fermeture de l'acces public aux vues techniques.
-- Ces vues sont en mode SECURITY DEFINER et contournent la RLS des tables
-- sous-jacentes. Six d'entre elles exposaient outreach_contacts et
-- outreach_campaigns (emails nominatifs de prospection) a tout visiteur.
-- Aucune n'est consommee par le front. Les Edge Functions et N8N qui les
-- lisent utilisent service_role, non affecte par REVOKE.

REVOKE ALL ON public.v_a_classifier                FROM anon, authenticated;
REVOKE ALL ON public.v_a_enrichir                  FROM anon, authenticated;
REVOKE ALL ON public.v_a_enrichir_test             FROM anon, authenticated;
REVOKE ALL ON public.v_exposants_eligibles         FROM anon, authenticated;
REVOKE ALL ON public.v_eligibles_nouveaute         FROM anon, authenticated;
REVOKE ALL ON public.v_eligibles_revendication     FROM anon, authenticated;
REVOKE ALL ON public.v_events_outreach_eligible    FROM anon, authenticated;
REVOKE ALL ON public.v_outreach_campaigns_missing  FROM anon, authenticated;
REVOKE ALL ON public.v_labels_a_mapper             FROM anon, authenticated;
REVOKE ALL ON public.exposants_a_enrichir          FROM anon, authenticated;
REVOKE ALL ON public.crm_radar_participations_view FROM anon, authenticated;
