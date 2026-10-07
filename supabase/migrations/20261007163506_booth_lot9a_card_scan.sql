-- Lotexpo Leads, Lot 9A : scan de carte de visite et de badge (journal et contrôles d'accès).
-- Purement additif : 1 table, 3 fonctions, 1 tâche planifiée de purge. Aucun objet existant modifié.
-- La photo n'est jamais stockée : seule la fonction Edge booth-card-scan la voit, en mémoire.
-- Le journal sert au benchmark (One Tap Rate, erreurs) et au plafond quotidien ;
-- les champs lus sur la carte (extracted) sont effacés au bout de 30 jours.

-- =========================================================================
-- 1. Table du journal des scans
-- =========================================================================
CREATE TABLE public.booth_card_scans (
  id uuid PRIMARY KEY,                       -- créé par le téléphone (idempotence des renvois)
  exhibitor_id uuid NOT NULL,
  workspace_id uuid NOT NULL,
  user_id uuid NOT NULL,
  kind text NOT NULL DEFAULT 'card' CHECK (kind IN ('card','badge')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','ok','unreadable','error')),
  error_code text,
  model text,
  latency_ms integer,
  input_tokens integer,
  output_tokens integer,
  attempts integer NOT NULL DEFAULT 1,
  extracted jsonb,                           -- champs lus + confiance ; effacé après 30 jours
  contact_id uuid,                           -- contact enregistré à partir de ce scan
  linked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  FOREIGN KEY (workspace_id, exhibitor_id) REFERENCES public.booth_workspaces (id, exhibitor_id)
);

CREATE INDEX booth_card_scans_user_day_idx ON public.booth_card_scans (user_id, created_at DESC);
CREATE INDEX booth_card_scans_exhibitor_day_idx ON public.booth_card_scans (exhibitor_id, created_at DESC);
CREATE INDEX booth_card_scans_workspace_idx ON public.booth_card_scans (workspace_id, created_at DESC);

ALTER TABLE public.booth_card_scans ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.booth_card_scans FROM anon, authenticated;

COMMENT ON TABLE public.booth_card_scans IS
  'Lotexpo Leads : journal des scans de cartes et badges (sans photo). Accès uniquement par fonctions. extracted effacé après 30 jours.';

-- =========================================================================
-- 2. Autorisation d'un scan (appelée par booth-card-scan avec la session de l'utilisateur)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.booth_card_scan_authorize(
  p_workspace_id uuid,
  p_scan_id uuid,
  p_kind text DEFAULT 'card'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := public._booth_require_user();
  w public.booth_workspaces%ROWTYPE;
  v_role text;
  v_existing public.booth_card_scans%ROWTYPE;
  v_user_today int;
  v_exh_today int;
  c_user_max constant int := 200;     -- scans par personne et par jour
  c_exh_max constant int := 1500;     -- scans par exposant et par jour
  c_retry_max constant int := 3;      -- nouvelles tentatives d'un même scan
BEGIN
  IF p_workspace_id IS NULL OR p_scan_id IS NULL OR coalesce(p_kind, '') NOT IN ('card','badge') THEN
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
  IF w.archived_at IS NOT NULL THEN
    RAISE EXCEPTION 'BOOTH_WORKSPACE_ARCHIVED';
  END IF;
  -- Lecture de carte par IA : formules Bêta, Pass du salon, Annuel (pas la formule gratuite)
  IF NOT public._booth_has_full_features(w.exhibitor_id, w.event_id) THEN
    RAISE EXCEPTION 'BOOTH_PLAN_REQUIRED';
  END IF;

  -- Renvoi d'un même scan (réseau coupé pendant l'appel) : pas de double comptage
  SELECT * INTO v_existing FROM public.booth_card_scans WHERE id = p_scan_id FOR UPDATE;
  IF FOUND THEN
    IF v_existing.user_id <> v_uid OR v_existing.workspace_id <> p_workspace_id THEN
      RAISE EXCEPTION 'BOOTH_FORBIDDEN';
    END IF;
    IF v_existing.status IN ('ok','unreadable') THEN
      RETURN jsonb_build_object('scan_id', p_scan_id, 'status', v_existing.status,
                                'already_done', true, 'extracted', v_existing.extracted);
    END IF;
    IF v_existing.attempts >= c_retry_max THEN
      RAISE EXCEPTION 'BOOTH_RATE_LIMITED';
    END IF;
    UPDATE public.booth_card_scans
       SET attempts = attempts + 1, status = 'pending', error_code = NULL
     WHERE id = p_scan_id;
    RETURN jsonb_build_object('scan_id', p_scan_id, 'status', 'pending', 'already_done', false);
  END IF;

  SELECT count(*) INTO v_user_today FROM public.booth_card_scans
   WHERE user_id = v_uid AND created_at > now() - interval '24 hours';
  IF v_user_today >= c_user_max THEN
    RAISE EXCEPTION 'BOOTH_RATE_LIMITED';
  END IF;
  SELECT count(*) INTO v_exh_today FROM public.booth_card_scans
   WHERE exhibitor_id = w.exhibitor_id AND created_at > now() - interval '24 hours';
  IF v_exh_today >= c_exh_max THEN
    RAISE EXCEPTION 'BOOTH_RATE_LIMITED';
  END IF;

  INSERT INTO public.booth_card_scans (id, exhibitor_id, workspace_id, user_id, kind)
  VALUES (p_scan_id, w.exhibitor_id, w.id, v_uid, p_kind);

  RETURN jsonb_build_object('scan_id', p_scan_id, 'status', 'pending', 'already_done', false,
                            'remaining_today', c_user_max - v_user_today - 1);
END $$;

-- =========================================================================
-- 3. Résultat d'un scan (appelée par booth-card-scan avec la clé serveur uniquement)
-- =========================================================================
CREATE OR REPLACE FUNCTION public._booth_card_scan_complete(
  p_scan_id uuid,
  p_status text,
  p_extracted jsonb,
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
  IF p_status NOT IN ('ok','unreadable','error') THEN
    RAISE EXCEPTION 'BOOTH_INVALID_INPUT';
  END IF;
  UPDATE public.booth_card_scans
     SET status = p_status,
         extracted = CASE WHEN p_status = 'ok' THEN p_extracted END,
         model = left(p_model, 80),
         latency_ms = p_latency_ms,
         input_tokens = p_input_tokens,
         output_tokens = p_output_tokens,
         error_code = left(p_error_code, 60),
         completed_at = now()
   WHERE id = p_scan_id AND status = 'pending';
END $$;

-- =========================================================================
-- 4. Lien scan vers contact enregistré (appelée par le site, mesure du benchmark)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.booth_card_scan_link(p_scan_id uuid, p_contact_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := public._booth_require_user();
  s public.booth_card_scans%ROWTYPE;
BEGIN
  IF p_scan_id IS NULL OR p_contact_id IS NULL THEN
    RAISE EXCEPTION 'BOOTH_INVALID_INPUT';
  END IF;
  SELECT * INTO s FROM public.booth_card_scans WHERE id = p_scan_id;
  IF NOT FOUND OR s.user_id <> v_uid THEN
    RAISE EXCEPTION 'BOOTH_NOT_FOUND';
  END IF;
  -- Le contact peut ne pas être encore synchronisé : pas de contrôle d'existence ici
  UPDATE public.booth_card_scans
     SET contact_id = p_contact_id, linked_at = now()
   WHERE id = p_scan_id;
  RETURN jsonb_build_object('scan_id', p_scan_id, 'linked', true);
END $$;

-- =========================================================================
-- 5. Droits d'exécution
-- =========================================================================
REVOKE ALL ON FUNCTION public.booth_card_scan_authorize(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.booth_card_scan_authorize(uuid, uuid, text) TO authenticated;

REVOKE ALL ON FUNCTION public.booth_card_scan_link(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.booth_card_scan_link(uuid, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public._booth_card_scan_complete(uuid, text, jsonb, text, integer, integer, integer, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._booth_card_scan_complete(uuid, text, jsonb, text, integer, integer, integer, text)
  TO service_role;

-- =========================================================================
-- 6. Purge quotidienne : champs lus effacés après 30 jours (3 h 17, heure UTC)
-- =========================================================================
SELECT cron.schedule(
  'booth-card-scans-purge',
  '17 3 * * *',
  $cron$UPDATE public.booth_card_scans SET extracted = NULL
        WHERE extracted IS NOT NULL AND created_at < now() - interval '30 days'$cron$
);
