-- Lotexpo Leads, lot P4 : un seul Pass par salon et par fiche (test de Thomas du 10/10 : 2 Pass payés pour SEPEM Grenoble).
-- 1. booth_checkout_prepare refuse un Pass pour un salon déjà payé (BOOTH_ALREADY_PAID). Reste du corps identique au correctif du 10/10.
-- 2. _booth_payment_settle signale un doublon (deux pages de paiement ouvertes en même temps) par 'duplicate' = true :
--    le paiement est enregistré (l'argent est encaissé) et le webhook prévient l'admin pour rembourser. Reste du corps identique.

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
    -- Un seul Pass par salon et par fiche
    IF EXISTS (SELECT 1 FROM public.booth_payments bp
                WHERE bp.exhibitor_id = p_exhibitor_id AND bp.plan = 'pass'
                  AND bp.event_id = p_event_id AND bp.status = 'paid') THEN
      RAISE EXCEPTION 'BOOTH_ALREADY_PAID';
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

CREATE OR REPLACE FUNCTION public._booth_payment_settle(
  p_session_id text,
  p_payment_intent text,
  p_amount_total integer,
  p_currency text,
  p_customer_id text,
  p_invoice_id text,
  p_invoice_url text,
  p_invoice_pdf text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p public.booth_payments%ROWTYPE;
  a public.booth_access%ROWTYPE;
  s public.booth_billing_settings%ROWTYPE;
  v_until timestamptz;
  v_end date;
  v_keep_annual boolean := false;
  v_duplicate boolean := false;
BEGIN
  SELECT * INTO p FROM public.booth_payments WHERE stripe_session_id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'BOOTH_NOT_FOUND'; END IF;

  -- Rejeu du webhook : on complète seulement la facture si elle manquait
  IF p.status = 'paid' THEN
    UPDATE public.booth_payments
       SET stripe_invoice_id = coalesce(stripe_invoice_id, p_invoice_id),
           invoice_url = coalesce(invoice_url, p_invoice_url),
           invoice_pdf = coalesce(invoice_pdf, p_invoice_pdf),
           updated_at = now()
     WHERE id = p.id;
    RETURN jsonb_build_object('result', 'already_paid', 'payment_id', p.id);
  END IF;
  IF p.status NOT IN ('pending','expired') THEN
    RETURN jsonb_build_object('result', 'ignored', 'status', p.status, 'payment_id', p.id);
  END IF;

  IF p_amount_total IS DISTINCT FROM p.amount_cents OR lower(coalesce(p_currency,'')) <> p.currency THEN
    UPDATE public.booth_payments SET status = 'mismatch', stripe_payment_intent = p_payment_intent, updated_at = now() WHERE id = p.id;
    RETURN jsonb_build_object('result', 'mismatch', 'payment_id', p.id);
  END IF;

  SELECT * INTO s FROM public.booth_billing_settings WHERE id;
  SELECT * INTO a FROM public.booth_access WHERE exhibitor_id = p.exhibitor_id FOR UPDATE;

  IF p.plan = 'annual' THEN
    v_until := greatest(
      now(),
      CASE WHEN a.id IS NOT NULL AND a.status = 'approved' AND a.plan = 'annual' AND a.plan_valid_until > now()
           THEN a.plan_valid_until ELSE now() END
    ) + interval '12 months';
  ELSE
    SELECT coalesce(e.date_fin, e.date_debut) INTO v_end FROM public.events e WHERE e.id = p.event_id;
    v_until := ((coalesce(v_end, current_date) + s.pass_grace_days + 1)::timestamp AT TIME ZONE 'Europe/Paris');
    -- Un Annuel en cours plus long reste en place
    IF a.id IS NOT NULL AND a.status = 'approved' AND a.plan = 'annual' AND a.plan_valid_until > now() THEN
      v_keep_annual := true;
    END IF;
    -- Un Pass encore valide plus long n'est jamais raccourci
    IF a.id IS NOT NULL AND a.status = 'approved' AND a.plan = 'pass' AND a.plan_valid_until > v_until THEN
      v_until := a.plan_valid_until;
    END IF;
  END IF;

  -- Deux sessions ouvertes en parallèle pour le même salon : l'argent est encaissé, on le signale (remboursement manuel)
  IF p.plan = 'pass' THEN
    v_duplicate := EXISTS (SELECT 1 FROM public.booth_payments bp
                            WHERE bp.exhibitor_id = p.exhibitor_id AND bp.plan = 'pass'
                              AND bp.event_id = p.event_id AND bp.status = 'paid' AND bp.id <> p.id);
  END IF;

  UPDATE public.booth_payments
     SET status = 'paid', paid_at = now(), valid_until = v_until,
         stripe_payment_intent = p_payment_intent, stripe_customer_id = p_customer_id,
         stripe_invoice_id = p_invoice_id, invoice_url = p_invoice_url, invoice_pdf = p_invoice_pdf,
         updated_at = now()
   WHERE id = p.id;

  IF a.id IS NULL THEN
    INSERT INTO public.booth_access (exhibitor_id, status, requested_by, plan, plan_event_id, plan_valid_until,
                                     reviewed_at, admin_notified_at, decision_notified_at, admin_note)
    VALUES (p.exhibitor_id, 'approved', p.buyer_user_id, p.plan, CASE WHEN p.plan = 'pass' THEN p.event_id END, v_until,
            now(), now(), now(), 'Ouvert par paiement Stripe');
  ELSIF NOT v_keep_annual THEN
    -- decision_notified_at et admin_notified_at renseignés : booth-notify n'envoie rien,
    -- les emails de paiement partent du webhook.
    UPDATE public.booth_access
       SET status = 'approved',
           requested_by = coalesce(requested_by, p.buyer_user_id),
           plan = p.plan,
           plan_event_id = CASE WHEN p.plan = 'pass' THEN p.event_id END,
           plan_valid_until = v_until,
           reviewed_at = now(),
           admin_notified_at = coalesce(admin_notified_at, now()),
           decision_notified_at = now(),
           admin_note = 'Ouvert par paiement Stripe'
     WHERE id = a.id;
  END IF;

  RETURN jsonb_build_object(
    'result', 'paid',
    'payment_id', p.id,
    'exhibitor_id', p.exhibitor_id,
    'plan', p.plan,
    'event_id', p.event_id,
    'valid_until', v_until,
    'kept_annual', v_keep_annual,
    'duplicate', v_duplicate,
    'buyer_user_id', p.buyer_user_id,
    'buyer_email', p.buyer_email,
    'amount_cents', p.amount_cents
  );
END $$;

REVOKE ALL ON FUNCTION public._booth_payment_settle(text, text, integer, text, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._booth_payment_settle(text, text, integer, text, text, text, text, text) TO service_role;
