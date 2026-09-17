CREATE TABLE public.exhibitor_participation_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exhibitor_id uuid NOT NULL REFERENCES public.exhibitors(id) ON DELETE CASCADE,
  event_id uuid NULL REFERENCES public.events(id) ON DELETE SET NULL,
  proposed_event_name text NULL,
  proposed_event_url text NULL,
  proposed_event_city text NULL,
  proposed_event_start date NULL,
  stand text NULL,
  message text NULL,
  requested_by uuid NOT NULL REFERENCES auth.users(id),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  admin_note text NULL,
  reviewed_by uuid NULL REFERENCES auth.users(id),
  reviewed_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT epr_event_or_proposal CHECK (
    event_id IS NOT NULL OR nullif(btrim(coalesce(proposed_event_name,'')),'') IS NOT NULL
  )
);

GRANT SELECT, INSERT ON public.exhibitor_participation_requests TO authenticated;
GRANT UPDATE, DELETE ON public.exhibitor_participation_requests TO authenticated;
GRANT ALL ON public.exhibitor_participation_requests TO service_role;

ALTER TABLE public.exhibitor_participation_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers and admins can view participation requests"
  ON public.exhibitor_participation_requests
  FOR SELECT TO authenticated
  USING (public.is_admin() OR public.is_team_member(exhibitor_id));

CREATE POLICY "Managers can create participation requests"
  ON public.exhibitor_participation_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    requested_by = auth.uid()
    AND status = 'pending'
    AND reviewed_by IS NULL
    AND reviewed_at IS NULL
    AND admin_note IS NULL
    AND public.is_team_member(exhibitor_id)
  );

CREATE POLICY "Admins can update participation requests"
  ON public.exhibitor_participation_requests
  FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete participation requests"
  ON public.exhibitor_participation_requests
  FOR DELETE TO authenticated
  USING (public.is_admin());

CREATE UNIQUE INDEX epr_unique_pending_event
  ON public.exhibitor_participation_requests (exhibitor_id, event_id)
  WHERE status = 'pending' AND event_id IS NOT NULL;

CREATE INDEX epr_status_created_at
  ON public.exhibitor_participation_requests (status, created_at DESC);

-- Recherche de salons a venir (nom ou ville), insensible aux accents et a la casse
CREATE OR REPLACE FUNCTION public.search_upcoming_events(p_query text, p_limit int DEFAULT 10)
RETURNS TABLE(id uuid, nom_event text, slug text, ville text, date_debut date, date_fin date)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
  SELECT e.id, e.nom_event, e.slug, e.ville, e.date_debut::date, e.date_fin::date
  FROM public.events e
  WHERE e.is_test = false
    AND e.visible = true
    AND e.date_fin::date >= CURRENT_DATE
    AND (
      nullif(btrim(coalesce(p_query,'')),'') IS NULL
      OR extensions.unaccent(e.nom_event) ILIKE '%'||extensions.unaccent(btrim(p_query))||'%'
      OR extensions.unaccent(coalesce(e.ville,'')) ILIKE '%'||extensions.unaccent(btrim(p_query))||'%'
    )
  ORDER BY e.date_debut ASC
  LIMIT greatest(1, least(coalesce(p_limit, 10), 50));
$$;

REVOKE ALL ON FUNCTION public.search_upcoming_events(text, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_upcoming_events(text, int) TO authenticated, service_role;

-- Revue admin d'une demande de participation
CREATE OR REPLACE FUNCTION public.review_participation_request(
  p_request_id uuid,
  p_decision text,
  p_admin_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_req public.exhibitor_participation_requests;
  v_participation_id uuid;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'acces reserve aux administrateurs';
  END IF;

  IF p_decision NOT IN ('approved','rejected') THEN
    RAISE EXCEPTION 'decision invalide: %', p_decision;
  END IF;

  SELECT * INTO v_req
  FROM public.exhibitor_participation_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF v_req.id IS NULL THEN
    RAISE EXCEPTION 'demande introuvable';
  END IF;

  IF v_req.status <> 'pending' THEN
    RAISE EXCEPTION 'demande deja traitee (statut %)', v_req.status;
  END IF;

  IF p_decision = 'approved' AND v_req.event_id IS NOT NULL THEN
    v_participation_id := public.ensure_participation(
      v_req.exhibitor_id,
      v_req.event_id,
      nullif(btrim(coalesce(v_req.stand,'')), '')
    );
  END IF;

  UPDATE public.exhibitor_participation_requests
     SET status = p_decision,
         admin_note = p_admin_note,
         reviewed_by = auth.uid(),
         reviewed_at = now()
   WHERE id = p_request_id;

  RETURN jsonb_build_object(
    'request_id', p_request_id,
    'status', p_decision,
    'participation_id', v_participation_id,
    'participation_created', v_participation_id IS NOT NULL
  );
END
$$;

REVOKE ALL ON FUNCTION public.review_participation_request(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.review_participation_request(uuid, text, text) TO authenticated, service_role;

-- Webhook de notification (meme mecanisme que radar_leads_notify)
DROP TRIGGER IF EXISTS exhibitor_participation_requests_notify ON public.exhibitor_participation_requests;
CREATE TRIGGER exhibitor_participation_requests_notify
AFTER INSERT ON public.exhibitor_participation_requests
FOR EACH ROW
EXECUTE FUNCTION supabase_functions.http_request(
  'https://vxivdvzzhebobveedxbj.supabase.co/functions/v1/notify-exhibitor-participation-request',
  'POST',
  '{"Content-type":"application/json"}',
  '{}',
  '5000'
);