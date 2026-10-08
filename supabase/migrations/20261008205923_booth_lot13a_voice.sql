-- Lotexpo Leads, Lot 13A : notes vocales (journal, contrôles d'accès, quotas).
-- Purement additif : 1 table, 5 fonctions, 1 tâche planifiée de purge. Aucun objet existant modifié.
-- L'audio n'est jamais stocké : seule la fonction Edge booth-voice-note le voit, en mémoire.
-- La transcription et les champs proposés sont effacés au bout de 30 jours.
-- Plafonds : 90 s par note ; 100 notes par personne et 600 par exposant sur 24 h ;
-- 300 notes par exposant et par mois civil (heure de Paris), offertes pendant la bêta.

-- =========================================================================
-- 1. Table du journal des notes vocales
-- =========================================================================
CREATE TABLE public.booth_voice_notes (
  id uuid PRIMARY KEY,                       -- créé par le téléphone (idempotence des renvois)
  exhibitor_id uuid NOT NULL,
  workspace_id uuid NOT NULL,
  user_id uuid NOT NULL,
  mode text NOT NULL DEFAULT 'capture' CHECK (mode IN ('capture','note')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','ok','empty','error')),
  error_code text,
  duration_ms integer CHECK (duration_ms IS NULL OR duration_ms BETWEEN 0 AND 90000),
  audio_bytes integer,
  transcribe_model text,
  analysis_model text,
  transcribe_ms integer,
  latency_ms integer,
  input_tokens integer,
  output_tokens integer,
  attempts integer NOT NULL DEFAULT 1,
  transcript text,                           -- effacé après 30 jours
  extracted jsonb,                           -- champs proposés ; effacé après 30 jours
  interaction_id uuid,                       -- rencontre enregistrée à partir de cette note
  linked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  FOREIGN KEY (workspace_id, exhibitor_id) REFERENCES public.booth_workspaces (id, exhibitor_id)
);

CREATE INDEX booth_voice_notes_user_day_idx ON public.booth_voice_notes (user_id, created_at DESC);
CREATE INDEX booth_voice_notes_exhibitor_day_idx ON public.booth_voice_notes (exhibitor_id, created_at DESC);
CREATE INDEX booth_voice_notes_workspace_idx ON public.booth_voice_notes (workspace_id, created_at DESC);

ALTER TABLE public.booth_voice_notes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.booth_voice_notes FROM anon, authenticated;

COMMENT ON TABLE public.booth_voice_notes IS
  'Lotexpo Leads : journal des notes vocales (sans audio). Accès uniquement par fonctions. transcript et extracted effacés après 30 jours.';

-- =========================================================================
-- 2. Consommation du mois (interne)
-- =========================================================================
CREATE OR REPLACE FUNCTION public._booth_voice_month_used(p_exhibitor_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::int
  FROM public.booth_voice_notes
  WHERE exhibitor_id = p_exhibitor_id
    AND status <> 'error'                    -- une note en échec ne consomme pas le plafond
    AND created_at >= (date_trunc('month', now() AT TIME ZONE 'Europe/Paris') AT TIME ZONE 'Europe/Paris')
$$;

REVOKE ALL ON FUNCTION public._booth_voice_month_used(uuid) FROM PUBLIC, anon, authenticated;

-- =========================================================================
-- 3. Autorisation d'une note (appelée par booth-voice-note avec la session de l'utilisateur)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.booth_voice_authorize(
  p_workspace_id uuid,
  p_note_id uuid,
  p_duration_ms integer,
  p_mode text DEFAULT 'capture'
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
  v_existing public.booth_voice_notes%ROWTYPE;
  v_user_today int;
  v_exh_today int;
  v_month int;
  c_max_ms constant int := 90000;      -- 90 secondes par note
  c_user_max constant int := 100;      -- notes par personne sur 24 h
  c_exh_max constant int := 600;       -- notes par exposant sur 24 h
  c_month_max constant int := 300;     -- notes par exposant et par mois civil (offertes en bêta)
  c_retry_max constant int := 3;       -- nouvelles tentatives d'une même note
  v_ctx jsonb;
BEGIN
  IF p_workspace_id IS NULL OR p_note_id IS NULL OR coalesce(p_mode, '') NOT IN ('capture','note')
     OR p_duration_ms IS NULL OR p_duration_ms < 0 THEN
    RAISE EXCEPTION 'BOOTH_INVALID_INPUT';
  END IF;
  IF p_duration_ms > c_max_ms THEN
    RAISE EXCEPTION 'BOOTH_AUDIO_TOO_LONG';
  END IF;

  SELECT * INTO w FROM public.booth_workspaces WHERE id = p_workspace_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'BOOTH_NOT_FOUND';
  END IF;
  v_role := public.booth_role(w.exhibitor_id);
  IF v_role IS NULL THEN
    RAISE EXCEPTION 'BOOTH_NOT_FOUND';
  END IF;
  IF w.archived_at IS NOT NULL THEN
    RAISE EXCEPTION 'BOOTH_WORKSPACE_ARCHIVED';
  END IF;
  -- Vocal : formules Bêta, Pass du salon, Annuel (pas la formule gratuite), comme booth_sync
  IF NOT public._booth_has_full_features(w.exhibitor_id, w.event_id) THEN
    RAISE EXCEPTION 'BOOTH_PLAN_REQUIRED';
  END IF;

  SELECT * INTO e FROM public.events WHERE id = w.event_id;
  v_ctx := jsonb_build_object(
    'today_local', to_char(now() AT TIME ZONE w.timezone, 'YYYY-MM-DD'),
    'salon_name', e.nom_event,
    'salon_start', e.date_debut,
    'salon_end', coalesce(e.date_fin, e.date_debut),
    'timezone', w.timezone
  );

  -- Renvoi d'une même note (réseau coupé pendant l'appel) : pas de double comptage
  SELECT * INTO v_existing FROM public.booth_voice_notes WHERE id = p_note_id FOR UPDATE;
  IF FOUND THEN
    IF v_existing.user_id <> v_uid OR v_existing.workspace_id <> p_workspace_id THEN
      RAISE EXCEPTION 'BOOTH_FORBIDDEN';
    END IF;
    IF v_existing.status IN ('ok','empty') THEN
      RETURN jsonb_build_object('note_id', p_note_id, 'status', v_existing.status, 'already_done', true,
                                'transcript', v_existing.transcript, 'extracted', v_existing.extracted,
                                'context', v_ctx);
    END IF;
    IF v_existing.attempts >= c_retry_max THEN
      RAISE EXCEPTION 'BOOTH_RATE_LIMITED';
    END IF;
    UPDATE public.booth_voice_notes
       SET attempts = attempts + 1, status = 'pending', error_code = NULL,
           mode = p_mode, duration_ms = p_duration_ms
     WHERE id = p_note_id;
    RETURN jsonb_build_object('note_id', p_note_id, 'status', 'pending', 'already_done', false, 'context', v_ctx);
  END IF;

  SELECT count(*) INTO v_user_today FROM public.booth_voice_notes
   WHERE user_id = v_uid AND created_at > now() - interval '24 hours';
  IF v_user_today >= c_user_max THEN
    RAISE EXCEPTION 'BOOTH_RATE_LIMITED';
  END IF;
  SELECT count(*) INTO v_exh_today FROM public.booth_voice_notes
   WHERE exhibitor_id = w.exhibitor_id AND created_at > now() - interval '24 hours';
  IF v_exh_today >= c_exh_max THEN
    RAISE EXCEPTION 'BOOTH_RATE_LIMITED';
  END IF;
  v_month := public._booth_voice_month_used(w.exhibitor_id);
  IF v_month >= c_month_max THEN
    RAISE EXCEPTION 'BOOTH_VOICE_QUOTA';
  END IF;

  INSERT INTO public.booth_voice_notes (id, exhibitor_id, workspace_id, user_id, mode, duration_ms)
  VALUES (p_note_id, w.exhibitor_id, w.id, v_uid, p_mode, p_duration_ms);

  RETURN jsonb_build_object('note_id', p_note_id, 'status', 'pending', 'already_done', false,
                            'remaining_month', c_month_max - v_month - 1, 'context', v_ctx);
END $$;

-- =========================================================================
-- 4. Résultat d'une note (appelée par booth-voice-note avec la clé serveur uniquement)
-- =========================================================================
CREATE OR REPLACE FUNCTION public._booth_voice_complete(
  p_note_id uuid,
  p_status text,
  p_transcript text,
  p_extracted jsonb,
  p_transcribe_model text,
  p_analysis_model text,
  p_transcribe_ms integer,
  p_latency_ms integer,
  p_input_tokens integer,
  p_output_tokens integer,
  p_audio_bytes integer,
  p_error_code text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_status NOT IN ('ok','empty','error') THEN
    RAISE EXCEPTION 'BOOTH_INVALID_INPUT';
  END IF;
  UPDATE public.booth_voice_notes
     SET status = p_status,
         transcript = CASE WHEN p_status = 'ok' THEN left(p_transcript, 10000) END,
         extracted = CASE WHEN p_status = 'ok' THEN p_extracted END,
         transcribe_model = left(p_transcribe_model, 80),
         analysis_model = left(p_analysis_model, 80),
         transcribe_ms = p_transcribe_ms,
         latency_ms = p_latency_ms,
         input_tokens = p_input_tokens,
         output_tokens = p_output_tokens,
         audio_bytes = p_audio_bytes,
         error_code = left(p_error_code, 60),
         completed_at = now()
   WHERE id = p_note_id AND status = 'pending';
END $$;

-- =========================================================================
-- 5. Lien note vers rencontre enregistrée (appelée par le site, mesure de l'usage)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.booth_voice_link(p_note_id uuid, p_interaction_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := public._booth_require_user();
  n public.booth_voice_notes%ROWTYPE;
BEGIN
  IF p_note_id IS NULL OR p_interaction_id IS NULL THEN
    RAISE EXCEPTION 'BOOTH_INVALID_INPUT';
  END IF;
  SELECT * INTO n FROM public.booth_voice_notes WHERE id = p_note_id;
  IF NOT FOUND OR n.user_id <> v_uid THEN
    RAISE EXCEPTION 'BOOTH_NOT_FOUND';
  END IF;
  -- La rencontre peut ne pas être encore synchronisée : pas de contrôle d'existence ici
  UPDATE public.booth_voice_notes
     SET interaction_id = p_interaction_id, linked_at = now()
   WHERE id = p_note_id;
  RETURN jsonb_build_object('note_id', p_note_id, 'linked', true);
END $$;

-- =========================================================================
-- 6. Consommation du mois pour l'affichage (« 287 notes restantes ce mois-ci »)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.booth_voice_usage(p_workspace_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  w public.booth_workspaces%ROWTYPE;
  v_used int;
  c_month_max constant int := 300;
BEGIN
  PERFORM public._booth_require_user();
  SELECT * INTO w FROM public.booth_workspaces WHERE id = p_workspace_id;
  IF NOT FOUND OR public.booth_role(w.exhibitor_id) IS NULL THEN
    RAISE EXCEPTION 'BOOTH_NOT_FOUND';
  END IF;
  v_used := public._booth_voice_month_used(w.exhibitor_id);
  RETURN jsonb_build_object(
    'available', public._booth_has_full_features(w.exhibitor_id, w.event_id) AND w.archived_at IS NULL,
    'used_month', v_used,
    'limit_month', c_month_max,
    'remaining_month', greatest(c_month_max - v_used, 0),
    'max_seconds', 90);
END $$;

-- =========================================================================
-- 7. Droits d'exécution
-- =========================================================================
REVOKE ALL ON FUNCTION public.booth_voice_authorize(uuid, uuid, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.booth_voice_authorize(uuid, uuid, integer, text) TO authenticated;

REVOKE ALL ON FUNCTION public.booth_voice_link(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.booth_voice_link(uuid, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.booth_voice_usage(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.booth_voice_usage(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public._booth_voice_complete(uuid, text, text, jsonb, text, text, integer, integer, integer, integer, integer, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._booth_voice_complete(uuid, text, text, jsonb, text, text, integer, integer, integer, integer, integer, text)
  TO service_role;

-- =========================================================================
-- 8. Purge quotidienne : transcription et champs effacés après 30 jours (3 h 23, heure UTC)
-- =========================================================================
SELECT cron.schedule(
  'booth-voice-notes-purge',
  '23 3 * * *',
  $cron$UPDATE public.booth_voice_notes SET transcript = NULL, extracted = NULL
        WHERE (transcript IS NOT NULL OR extracted IS NOT NULL) AND created_at < now() - interval '30 days'$cron$
);
