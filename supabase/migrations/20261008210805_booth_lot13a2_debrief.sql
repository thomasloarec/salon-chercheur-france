-- Lotexpo Leads, Lot 13A (2) : synthèse IA du débrief du jour.
-- Purement additif : 1 table de journal (sans contenu), 2 fonctions. Aucun objet existant modifié.
-- booth_debrief_authorize contrôle les droits et le plafond, puis renvoie les rencontres du jour sous forme
-- compacte (jamais d'email ni de téléphone) à la fonction Edge booth-debrief-summary, qui rédige la synthèse.
-- La synthèse n'est pas stockée côté serveur : seul un journal technique (modèle, durée, jetons) est conservé.
-- Plafonds : 30 synthèses par personne et 300 par exposant sur 24 h.

-- =========================================================================
-- 1. Journal des synthèses (sans contenu)
-- =========================================================================
CREATE TABLE public.booth_debrief_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exhibitor_id uuid NOT NULL,
  workspace_id uuid NOT NULL,
  user_id uuid NOT NULL,
  day date,                                  -- null = tout le salon
  scope text NOT NULL CHECK (scope IN ('team','mine')),
  meetings integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','ok','empty','error')),
  error_code text,
  model text,
  latency_ms integer,
  input_tokens integer,
  output_tokens integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  FOREIGN KEY (workspace_id, exhibitor_id) REFERENCES public.booth_workspaces (id, exhibitor_id)
);

CREATE INDEX booth_debrief_summaries_user_day_idx ON public.booth_debrief_summaries (user_id, created_at DESC);
CREATE INDEX booth_debrief_summaries_exhibitor_day_idx ON public.booth_debrief_summaries (exhibitor_id, created_at DESC);

ALTER TABLE public.booth_debrief_summaries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.booth_debrief_summaries FROM anon, authenticated;

COMMENT ON TABLE public.booth_debrief_summaries IS
  'Lotexpo Leads : journal technique des synthèses IA du débrief (aucun contenu stocké). Accès uniquement par fonctions.';

-- =========================================================================
-- 2. Autorisation et données du débrief (appelée par booth-debrief-summary avec la session de l'utilisateur)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.booth_debrief_authorize(
  p_workspace_id uuid,
  p_day date,
  p_scope text DEFAULT 'team'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := public._booth_require_user();
  w public.booth_workspaces%ROWTYPE;
  e public.events%ROWTYPE;
  v_role text;
  v_user_today int;
  v_exh_today int;
  v_items jsonb;
  v_total int;
  v_id uuid;
  c_user_max constant int := 30;       -- synthèses par personne sur 24 h
  c_exh_max constant int := 300;       -- synthèses par exposant sur 24 h
  c_items_max constant int := 300;     -- rencontres envoyées au modèle au plus
BEGIN
  IF p_workspace_id IS NULL OR coalesce(p_scope, '') NOT IN ('team','mine') THEN
    RAISE EXCEPTION 'BOOTH_INVALID_INPUT';
  END IF;

  SELECT * INTO w FROM public.booth_workspaces WHERE id = p_workspace_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'BOOTH_NOT_FOUND';
  END IF;
  v_role := public.booth_role(w.exhibitor_id);
  IF v_role IS NULL THEN
    RAISE EXCEPTION 'BOOTH_NOT_FOUND';
  END IF;
  -- Synthèse IA : formules Bêta, Pass du salon, Annuel (pas la formule gratuite)
  IF NOT public._booth_has_full_features(w.exhibitor_id, w.event_id) THEN
    RAISE EXCEPTION 'BOOTH_PLAN_REQUIRED';
  END IF;

  SELECT count(*) INTO v_user_today FROM public.booth_debrief_summaries
   WHERE user_id = v_uid AND created_at > now() - interval '24 hours';
  IF v_user_today >= c_user_max THEN
    RAISE EXCEPTION 'BOOTH_RATE_LIMITED';
  END IF;
  SELECT count(*) INTO v_exh_today FROM public.booth_debrief_summaries
   WHERE exhibitor_id = w.exhibitor_id AND created_at > now() - interval '24 hours';
  IF v_exh_today >= c_exh_max THEN
    RAISE EXCEPTION 'BOOTH_RATE_LIMITED';
  END IF;

  SELECT * INTO e FROM public.events WHERE id = w.event_id;

  -- Rencontres du périmètre (jour local du salon), sans email ni téléphone
  WITH base AS (
    SELECT i.*, c.company_name, c.first_name, c.last_name, c.job_title,
           (i.occurred_at AT TIME ZONE w.timezone) AS local_ts
    FROM public.booth_interactions i
    JOIN public.booth_contacts c ON c.id = i.contact_id
    WHERE i.workspace_id = w.id
      AND i.status = 'completed'
      AND (p_day IS NULL OR (i.occurred_at AT TIME ZONE w.timezone)::date = p_day)
      AND (p_scope = 'team' OR i.owner_user_id = v_uid)
  )
  SELECT count(*)::int,
         coalesce(jsonb_agg(x ORDER BY x->>'time') FILTER (WHERE rn <= c_items_max), '[]'::jsonb)
    INTO v_total, v_items
  FROM (
    SELECT row_number() OVER (ORDER BY b.local_ts) AS rn,
           jsonb_strip_nulls(jsonb_build_object(
             'time', to_char(b.local_ts, 'YYYY-MM-DD HH24:MI'),
             'company', b.company_name,
             'person', nullif(btrim(coalesce(b.first_name, '') || ' ' || coalesce(b.last_name, '')), ''),
             'job_title', b.job_title,
             'relationship', b.relationship,
             'customer_topic', b.customer_topic,
             'potential', b.potential,
             'next_action', nullif(b.next_action, 'none'),
             'next_action_due', b.next_action_due,
             'action_done', b.next_action_done_at IS NOT NULL,
             'followed_by', public._booth_user_label(b.owner_user_id),
             'note', left(b.note, 500),
             'project', (SELECT jsonb_strip_nulls(jsonb_build_object('title', o.title, 'amount', o.amount,
                                   'value_band', o.value_band, 'horizon', o.horizon))
                           FROM public.booth_opportunities o
                          WHERE o.origin_interaction_id = b.id AND o.status <> 'abandoned'
                          ORDER BY o.created_at LIMIT 1)
           )) AS x
    FROM base b
  ) s;

  INSERT INTO public.booth_debrief_summaries (exhibitor_id, workspace_id, user_id, day, scope, meetings, status)
  VALUES (w.exhibitor_id, w.id, v_uid, p_day, p_scope, v_total, CASE WHEN v_total = 0 THEN 'empty' ELSE 'pending' END)
  RETURNING id INTO v_id;

  RETURN jsonb_build_object(
    'summary_id', v_id,
    'salon', jsonb_build_object('name', e.nom_event, 'start', e.date_debut, 'end', coalesce(e.date_fin, e.date_debut),
                                'today_local', to_char(now() AT TIME ZONE w.timezone, 'YYYY-MM-DD')),
    'day', p_day,
    'scope', p_scope,
    'total', v_total,
    'truncated', v_total > c_items_max,
    'items', v_items);
END $$;

-- =========================================================================
-- 3. Résultat technique (appelée par booth-debrief-summary avec la clé serveur uniquement)
-- =========================================================================
CREATE OR REPLACE FUNCTION public._booth_debrief_complete(
  p_summary_id uuid,
  p_status text,
  p_model text,
  p_latency_ms integer,
  p_input_tokens integer,
  p_output_tokens integer,
  p_error_code text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_status NOT IN ('ok','error') THEN
    RAISE EXCEPTION 'BOOTH_INVALID_INPUT';
  END IF;
  UPDATE public.booth_debrief_summaries
     SET status = p_status,
         model = left(p_model, 80),
         latency_ms = p_latency_ms,
         input_tokens = p_input_tokens,
         output_tokens = p_output_tokens,
         error_code = left(p_error_code, 60),
         completed_at = now()
   WHERE id = p_summary_id AND status = 'pending';
END $$;

-- =========================================================================
-- 4. Droits d'exécution
-- =========================================================================
REVOKE ALL ON FUNCTION public.booth_debrief_authorize(uuid, date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.booth_debrief_authorize(uuid, date, text) TO authenticated;

REVOKE ALL ON FUNCTION public._booth_debrief_complete(uuid, text, text, integer, integer, integer, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._booth_debrief_complete(uuid, text, text, integer, integer, integer, text)
  TO service_role;
