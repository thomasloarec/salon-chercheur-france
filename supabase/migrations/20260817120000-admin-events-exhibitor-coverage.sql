-- ============================================================
-- 20260817120000_admin_events_exhibitor_coverage
-- Suivi de complétude des exposants par événement (admin)
-- Colonnes de triage + vue de couverture (3 buckets) + RPC de bascule
--
-- NOTE : déjà appliquée en prod le 2026-08-17 via Supabase MCP.
--        Committer ce fichier pour le versionnage. Idempotent
--        (IF NOT EXISTS / CREATE OR REPLACE), ré-exécution sans effet.
-- ============================================================

-- 1) Colonnes de triage "sourcing exposants" sur events
--    (même esprit que enrichissement_ignored / exhibitors_confirmed_*)
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS exhibitor_sourcing_ignored boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS exhibitor_sourcing_ignored_at timestamptz,
  ADD COLUMN IF NOT EXISTS exhibitor_sourcing_ignored_by uuid;

COMMENT ON COLUMN public.events.exhibitor_sourcing_ignored IS
  'Admin: evenement qui n''aura jamais d''exposants a lister (sorti de la TODO de sourcing).';

-- 2) Vue de couverture (3 buckets), reservee aux admins
--    security_invoker + garde is_admin() => 0 ligne pour un non-admin.
CREATE OR REPLACE VIEW public.admin_events_exhibitor_coverage
WITH (security_invoker = true) AS
SELECT
  e.id,
  e.nom_event,
  e.type_event,
  e.status_event,
  e.date_debut,
  e.date_fin,
  e.ville,
  e.slug,
  e.url_site_officiel,
  e.salon_priorite,
  e.exhibitor_sourcing_ignored,
  e.exhibitor_sourcing_ignored_at,
  COALESCE(pc.nb, 0)::int AS nb_exposants,
  CASE
    WHEN e.exhibitor_sourcing_ignored THEN 'ignored'
    WHEN COALESCE(pc.nb, 0) > 0        THEN 'has_exhibitors'
    ELSE 'todo'
  END AS bucket
FROM public.events e
LEFT JOIN (
  SELECT id_event, count(*) AS nb
  FROM public.participation
  WHERE id_event IS NOT NULL
  GROUP BY id_event
) pc ON pc.id_event = e.id
WHERE e.is_test = false
  AND e.visible = true
  AND e.date_debut >= CURRENT_DATE
  AND public.is_admin();

REVOKE ALL ON public.admin_events_exhibitor_coverage FROM PUBLIC, anon;
GRANT SELECT ON public.admin_events_exhibitor_coverage TO authenticated;

-- 3) RPC de bascule ignorer / remettre a traiter (defense en profondeur)
DROP FUNCTION IF EXISTS public.admin_set_event_exhibitor_ignored(uuid, boolean);
CREATE OR REPLACE FUNCTION public.admin_set_event_exhibitor_ignored(
  p_event_id uuid,
  p_ignored  boolean
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'forbidden' USING errcode = '42501';
  END IF;

  UPDATE events
  SET exhibitor_sourcing_ignored    = p_ignored,
      exhibitor_sourcing_ignored_at = CASE WHEN p_ignored THEN now()      ELSE NULL END,
      exhibitor_sourcing_ignored_by = CASE WHEN p_ignored THEN auth.uid() ELSE NULL END
  WHERE id = p_event_id;

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_event_exhibitor_ignored(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_event_exhibitor_ignored(uuid, boolean) TO authenticated;
