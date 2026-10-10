-- Lotexpo Leads, lot P, correctif : booth_checkout_prepare échouait pour l'Annuel
-- (« record v_ev is not assigned yet » : la variable du salon n'est remplie que pour un Pass).
-- Variables simples à la place de l'enregistrement ; logique inchangée.
CREATE OR REPLACE FUNCTION public.booth_checkout_prepare(p_exhibitor_id uuid, p_plan text, p_event_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := public._booth_require_user();
  s public.booth_billing_settings%ROWTYPE;
  v_access public.booth_access%ROWTYPE;
  v_ex_id uuid;
  v_ex_name text;
  v_ex_slug text;
  v_ev_id uuid;
  v_ev_name text;
  v_ev_end date;
  v_email text;
  v_pay public.booth_payments%ROWTYPE;
  v_recent integer;
BEGIN
  IF p_exhibitor_id IS NULL THEN RAISE EXCEPTION 'BOOTH_INVALID_INPUT'; END IF;
  SELECT id, name, slug INTO v_ex_id, v_ex_name, v_ex_slug FROM public.exhibitors WHERE id = p_exhibitor_id;
  IF v_ex_id IS NULL THEN RAISE EXCEPTION 'BOOTH_NOT_FOUND'; END IF;
  IF NOT public._booth_is_fiche_manager(p_exhibitor_id, v_uid) AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'BOOTH_FORBIDDEN';
  END IF;
  IF p_plan NOT IN ('pass','annual') THEN RAISE EXCEPTION 'BOOTH_INVALID_INPUT'; END IF;

  SELECT * INTO s FROM public.booth_billing_settings WHERE id;

  IF p_plan = 'pass' THEN
    IF p_event_id IS NULL THEN RAISE EXCEPTION 'BOOTH_INVALID_INPUT'; END IF;
    SELECT id, nom_event, coalesce(date_fin, date_debut) INTO v_ev_id, v_ev_name, v_ev_end FROM public.events WHERE id = p_event_id;
    IF v_ev_id IS NULL THEN RAISE EXCEPTION 'BOOTH_INVALID_INPUT'; END IF;
    IF v_ev_end IS NULL OR v_ev_end < current_date THEN
      RAISE EXCEPTION 'BOOTH_EVENT_PAST';
    END IF;
  ELSIF p_event_id IS NOT NULL THEN
    RAISE EXCEPTION 'BOOTH_INVALID_INPUT';
  END IF;

  -- Déjà couvert : un Pass n'a pas de sens pendant un Annuel en cours
  SELECT * INTO v_access FROM public.booth_access WHERE exhibitor_id = p_exhibitor_id;
  IF v_access.id IS NOT NULL AND p_plan = 'pass' AND v_access.status = 'approved' AND v_access.plan = 'annual'
     AND (v_access.plan_valid_until IS NULL OR v_access.plan_valid_until > now()) THEN
    RAISE EXCEPTION 'BOOTH_ALREADY_COVERED';
  END IF;
  IF v_access.id IS NOT NULL AND v_access.status = 'revoked' THEN
    RAISE EXCEPTION 'BOOTH_FORBIDDEN';
  END IF;

  -- Garde-fou : 10 tentatives par fiche et par 24 h
  SELECT count(*) INTO v_recent FROM public.booth_payments
   WHERE exhibitor_id = p_exhibitor_id AND created_at > now() - interval '24 hours';
  IF v_recent >= 10 THEN RAISE EXCEPTION 'BOOTH_RATE_LIMITED'; END IF;

  SELECT u.email INTO v_email FROM auth.users u WHERE u.id = v_uid;

  INSERT INTO public.booth_payments (exhibitor_id, plan, event_id, amount_cents, currency, livemode, buyer_user_id, buyer_email)
  VALUES (p_exhibitor_id, p_plan, v_ev_id,
          CASE WHEN p_plan = 'pass' THEN s.pass_amount_cents ELSE s.annual_amount_cents END,
          s.currency, s.stripe_livemode, v_uid, v_email)
  RETURNING * INTO v_pay;

  RETURN jsonb_build_object(
    'payment_id', v_pay.id,
    'plan', v_pay.plan,
    'price_id', CASE WHEN p_plan = 'pass' THEN s.pass_price_id ELSE s.annual_price_id END,
    'amount_cents', v_pay.amount_cents,
    'currency', v_pay.currency,
    'livemode', v_pay.livemode,
    'vat_mode', s.vat_mode,
    'buyer_email', v_email,
    'exhibitor_id', v_ex_id,
    'exhibitor_name', v_ex_name,
    'exhibitor_slug', v_ex_slug,
    'event_id', v_ev_id,
    'event_name', v_ev_name
  );
END $$;

REVOKE ALL ON FUNCTION public.booth_checkout_prepare(uuid, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.booth_checkout_prepare(uuid, text, uuid) TO authenticated;
