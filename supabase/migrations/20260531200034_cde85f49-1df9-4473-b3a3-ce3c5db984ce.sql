-- =========================================================================
-- Phase 4C-pre — Modèle data des alertes exposants (V5)
-- "Me prévenir de ses prochains salons"
-- Socle data + sécurité uniquement. Aucune notification / cron / UI.
-- =========================================================================

-- 1. Table -----------------------------------------------------------------
CREATE TABLE public.exhibitor_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  public_identity_id uuid NULL
    REFERENCES public.exhibitor_public_identities(id) ON DELETE SET NULL,
  public_slug text NOT NULL,
  display_name_snapshot text NULL,
  status text NOT NULL DEFAULT 'active',
  source_surface text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_notified_at timestamptz NULL,
  CONSTRAINT exhibitor_alerts_slug_not_blank
    CHECK (length(btrim(public_slug)) > 0),
  CONSTRAINT exhibitor_alerts_status_check
    CHECK (status IN ('active','paused')),
  CONSTRAINT exhibitor_alerts_source_surface_check
    CHECK (
      source_surface IS NULL
      OR source_surface IN (
        'exhibitor_profile',
        'event_exhibitor_modal',
        'event_exhibitor_list',
        'novelty_card'
      )
    )
);

-- 2. Grants / RLS (table de préférences utilisateur, jamais publique) -------
REVOKE ALL ON public.exhibitor_alerts FROM PUBLIC;
REVOKE ALL ON public.exhibitor_alerts FROM anon;
REVOKE ALL ON public.exhibitor_alerts FROM authenticated;
GRANT SELECT ON public.exhibitor_alerts TO authenticated;
GRANT ALL ON public.exhibitor_alerts TO service_role;

ALTER TABLE public.exhibitor_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own exhibitor alerts"
ON public.exhibitor_alerts
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Service role manages exhibitor alerts"
ON public.exhibitor_alerts
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- 3. Trigger updated_at ----------------------------------------------------
CREATE TRIGGER update_exhibitor_alerts_updated_at
BEFORE UPDATE ON public.exhibitor_alerts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Index d'unicité partiel (nom cohérent : couvre identity NON NULL) ------
CREATE UNIQUE INDEX exhibitor_alerts_user_identity_not_null_unique
ON public.exhibitor_alerts(user_id, public_identity_id)
WHERE public_identity_id IS NOT NULL;

-- 5. Index de lecture / futur moteur de notification -----------------------
CREATE INDEX exhibitor_alerts_user_status_idx
  ON public.exhibitor_alerts(user_id, status);
CREATE INDEX exhibitor_alerts_identity_status_idx
  ON public.exhibitor_alerts(public_identity_id, status);
CREATE INDEX exhibitor_alerts_slug_idx
  ON public.exhibitor_alerts(public_slug);
CREATE INDEX exhibitor_alerts_updated_at_idx
  ON public.exhibitor_alerts(updated_at DESC);

-- =========================================================================
-- 6. RPC set_exhibitor_alert(p_public_slug, p_enabled, p_source_surface)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.set_exhibitor_alert(
  p_public_slug text,
  p_enabled boolean,
  p_source_surface text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_slug text := btrim(coalesce(p_public_slug, ''));
  v_identity_id uuid;
  v_canonical_name text;
  v_existing public.exhibitor_alerts%ROWTYPE;
  v_result public.exhibitor_alerts%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '28000';
  END IF;

  -- enabled obligatoire : un NULL ne doit jamais être traité comme false
  IF p_enabled IS NULL THEN
    RAISE EXCEPTION 'enabled must not be null' USING ERRCODE = '22023';
  END IF;

  IF v_slug = '' THEN
    RAISE EXCEPTION 'public_slug must not be empty' USING ERRCODE = '22023';
  END IF;

  IF p_source_surface IS NOT NULL
     AND p_source_surface NOT IN (
       'exhibitor_profile','event_exhibitor_modal',
       'event_exhibitor_list','novelty_card'
     ) THEN
    RAISE EXCEPTION 'invalid source_surface' USING ERRCODE = '22023';
  END IF;

  SELECT id, canonical_name
    INTO v_identity_id, v_canonical_name
  FROM public.exhibitor_public_identities
  WHERE public_slug = v_slug AND is_active = true
  LIMIT 1;

  IF v_identity_id IS NULL THEN
    RAISE EXCEPTION 'no active exhibitor identity for slug %', v_slug
      USING ERRCODE = 'P0002';
  END IF;

  -- Chercher une alerte existante : identité d'abord, puis fallback slug
  SELECT * INTO v_existing
  FROM public.exhibitor_alerts
  WHERE user_id = v_uid AND public_identity_id = v_identity_id
  LIMIT 1;

  IF v_existing.id IS NULL THEN
    SELECT * INTO v_existing
    FROM public.exhibitor_alerts
    WHERE user_id = v_uid
      AND public_identity_id IS NULL
      AND public_slug = v_slug
    LIMIT 1;
  END IF;

  -- ----- ENABLE = true : créer ou réactiver (robuste concurrence) ---------
  IF p_enabled THEN
    IF v_existing.id IS NOT NULL THEN
      UPDATE public.exhibitor_alerts
      SET status = 'active',
          public_identity_id = v_identity_id,
          public_slug = v_slug,
          display_name_snapshot = coalesce(v_canonical_name, display_name_snapshot),
          source_surface = coalesce(p_source_surface, source_surface)
      WHERE id = v_existing.id
      RETURNING * INTO v_result;
    ELSE
      -- ON CONFLICT sur l'index partiel : un INSERT concurrent devient UPDATE
      INSERT INTO public.exhibitor_alerts (
        user_id, public_identity_id, public_slug,
        display_name_snapshot, status, source_surface
      )
      VALUES (
        v_uid, v_identity_id, v_slug,
        v_canonical_name, 'active', p_source_surface
      )
      ON CONFLICT (user_id, public_identity_id)
        WHERE public_identity_id IS NOT NULL
      DO UPDATE SET
        status = 'active',
        public_slug = EXCLUDED.public_slug,
        display_name_snapshot = coalesce(
          EXCLUDED.display_name_snapshot,
          public.exhibitor_alerts.display_name_snapshot
        ),
        source_surface = coalesce(
          EXCLUDED.source_surface,
          public.exhibitor_alerts.source_surface
        )
      RETURNING * INTO v_result;
    END IF;

    RETURN jsonb_build_object(
      'public_slug', v_result.public_slug,
      'enabled', true,
      'status', v_result.status
    );
  END IF;

  -- ----- ENABLE = false : paused si existant, sinon no-op -----------------
  IF v_existing.id IS NULL THEN
    RETURN jsonb_build_object(
      'public_slug', v_slug, 'enabled', false, 'status', NULL
    );
  END IF;

  UPDATE public.exhibitor_alerts
  SET status = 'paused'
  WHERE id = v_existing.id
  RETURNING * INTO v_result;

  RETURN jsonb_build_object(
    'public_slug', v_result.public_slug,
    'enabled', false,
    'status', v_result.status
  );
END;
$$;

REVOKE ALL ON FUNCTION public.set_exhibitor_alert(text, boolean, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_exhibitor_alert(text, boolean, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.set_exhibitor_alert(text, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_exhibitor_alert(text, boolean, text) TO service_role;

-- =========================================================================
-- 7. RPC get_my_exhibitor_alert_status(p_public_slug)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.get_my_exhibitor_alert_status(
  p_public_slug text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_slug text := btrim(coalesce(p_public_slug, ''));
  v_status text;
BEGIN
  IF v_uid IS NULL OR v_slug = '' THEN
    RETURN jsonb_build_object('enabled', false, 'status', NULL);
  END IF;

  SELECT a.status INTO v_status
  FROM public.exhibitor_alerts a
  LEFT JOIN public.exhibitor_public_identities i
    ON i.id = a.public_identity_id
  WHERE a.user_id = v_uid
    AND (
      a.public_slug = v_slug
      OR (i.public_slug = v_slug AND i.is_active = true)
    )
  ORDER BY (a.status = 'active') DESC, a.updated_at DESC
  LIMIT 1;

  IF v_status IS NULL THEN
    RETURN jsonb_build_object('enabled', false, 'status', NULL);
  END IF;

  RETURN jsonb_build_object(
    'enabled', (v_status = 'active'),
    'status', v_status
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_exhibitor_alert_status(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_exhibitor_alert_status(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_my_exhibitor_alert_status(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_exhibitor_alert_status(text) TO service_role;

-- =========================================================================
-- 8. PREUVE EXÉCUTÉE : ON CONFLICT + index partiel (auto-nettoyante)
-- =========================================================================
DO $proof$
DECLARE
  v_user uuid := gen_random_uuid();
  v_identity uuid;
  v_suffix text := substr(gen_random_uuid()::text, 1, 8);
  v_slug text := 'zzz-proof-alert-' || v_suffix;
  v_legacy text := 'zzz-proof-legacy-' || v_suffix;
  r1 jsonb; r2 jsonb; r3 jsonb;
  v_count int;
BEGIN
  -- Identité publique active de test : source legacy cohérente avec
  -- legacy_exposant_id, satisfait exhibitor_public_identities_at_least_one_ref_chk.
  INSERT INTO public.exhibitor_public_identities
    (public_slug, canonical_name, source_type, is_active, legacy_exposant_id)
  VALUES (v_slug, 'Proof Alert Co', 'legacy', true, v_legacy)
  RETURNING id INTO v_identity;

  -- (A) Preuve directe : l'arbitre d'index partiel est bien inféré.
  -- Si le prédicat ne correspondait pas, PostgreSQL échouerait ICI avec
  -- "no unique or exclusion constraint matching the ON CONFLICT specification".
  INSERT INTO public.exhibitor_alerts (user_id, public_identity_id, public_slug, status)
  VALUES (v_user, v_identity, v_slug, 'active')
  ON CONFLICT (user_id, public_identity_id) WHERE public_identity_id IS NOT NULL
  DO UPDATE SET status = 'active';

  -- Second INSERT identique : doit être absorbé en UPDATE (pas d'erreur).
  INSERT INTO public.exhibitor_alerts (user_id, public_identity_id, public_slug, status)
  VALUES (v_user, v_identity, v_slug, 'active')
  ON CONFLICT (user_id, public_identity_id) WHERE public_identity_id IS NOT NULL
  DO UPDATE SET status = 'active';

  SELECT count(*) INTO v_count FROM public.exhibitor_alerts
   WHERE user_id = v_user AND public_identity_id = v_identity;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'PROOF FAIL (raw ON CONFLICT): % lignes au lieu de 1', v_count;
  END IF;
  RAISE NOTICE 'PROOF A OK: ON CONFLICT infere bien index partiel, 1 ligne.';

  -- Repartir propre pour la preuve via RPC
  DELETE FROM public.exhibitor_alerts WHERE user_id = v_user;

  -- Simuler un utilisateur connecté pour auth.uid()
  PERFORM set_config('request.jwt.claim.sub', v_user::text, true);

  -- (1) Premier appel → ligne créée
  r1 := public.set_exhibitor_alert(v_slug, true, 'exhibitor_profile');
  IF (r1->>'enabled') <> 'true' OR (r1->>'status') <> 'active' THEN
    RAISE EXCEPTION 'PROOF FAIL call1: %', r1;
  END IF;

  -- (2) Deuxième appel identique → même ligne réactivée, pas d'erreur
  r2 := public.set_exhibitor_alert(v_slug, true, 'exhibitor_profile');
  IF (r2->>'enabled') <> 'true' OR (r2->>'status') <> 'active' THEN
    RAISE EXCEPTION 'PROOF FAIL call2: %', r2;
  END IF;

  -- (3) Troisième appel (simulation double clic) → pas d'erreur
  r3 := public.set_exhibitor_alert(v_slug, true, 'novelty_card');
  IF (r3->>'enabled') <> 'true' OR (r3->>'status') <> 'active' THEN
    RAISE EXCEPTION 'PROOF FAIL call3: %', r3;
  END IF;

  -- (4) Exactement 1 ligne pour (user_id, public_identity_id)
  SELECT count(*) INTO v_count FROM public.exhibitor_alerts
   WHERE user_id = v_user AND public_identity_id = v_identity;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'PROOF FAIL (RPC): % lignes au lieu de 1', v_count;
  END IF;

  RAISE NOTICE 'PROOF B OK: 3 appels enable=true, 1 seule ligne, retour=%', r3;

  -- Nettoyage complet : aucune donnée de test ne subsiste
  DELETE FROM public.exhibitor_alerts WHERE user_id = v_user;
  DELETE FROM public.exhibitor_public_identities WHERE id = v_identity;

  -- Vérif finale : aucune trace de test
  PERFORM 1 FROM public.exhibitor_alerts WHERE user_id = v_user;
  IF FOUND THEN
    RAISE EXCEPTION 'PROOF FAIL: nettoyage incomplet exhibitor_alerts';
  END IF;
  PERFORM 1 FROM public.exhibitor_public_identities WHERE id = v_identity;
  IF FOUND THEN
    RAISE EXCEPTION 'PROOF FAIL: nettoyage incomplet exhibitor_public_identities';
  END IF;

  RAISE NOTICE 'PROOF CLEANUP OK: aucune donnee de test residuelle.';
END
$proof$;