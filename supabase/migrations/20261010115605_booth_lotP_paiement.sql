-- Lotexpo Leads, lot P (serveur) : paiement Stripe du Pass salon et de l'Annuel.
-- Additif, sauf booth_invite_member (limite de 15 comptes, administrateurs de la fiche compris).
--
-- Principe :
--   1. booth_checkout_prepare (appelée par la fonction booth-checkout avec le jeton de l'utilisateur)
--      vérifie les droits et crée une ligne de paiement « pending ».
--   2. booth-checkout crée la session Stripe et l'attache (_booth_payment_attach, réservé au service).
--   3. Le webhook Stripe signé appelle _booth_payment_settle (réservé au service) :
--      paiement « paid », accès ouvert tout de suite (booth_access approved + formule + échéance).
-- Les tables n'ont aucune policy : lecture et écriture uniquement par ces fonctions.

-- =========================================================================
-- 1. Réglages de facturation (une seule ligne)
-- =========================================================================
CREATE TABLE public.booth_billing_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  stripe_livemode boolean NOT NULL DEFAULT false,
  vat_mode text NOT NULL DEFAULT 'franchise' CHECK (vat_mode IN ('franchise','vat')),
  pass_price_id text NOT NULL,
  pass_amount_cents integer NOT NULL CHECK (pass_amount_cents > 0),
  annual_price_id text NOT NULL,
  annual_amount_cents integer NOT NULL CHECK (annual_amount_cents > 0),
  currency text NOT NULL DEFAULT 'eur',
  pass_grace_days integer NOT NULL DEFAULT 60 CHECK (pass_grace_days BETWEEN 0 AND 365),
  updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.booth_billing_settings IS
  'Lotexpo Leads : réglages Stripe (mode test ou réel, prix, TVA). vat_mode franchise = mention art. 293 B du CGI, pas de TVA.';
ALTER TABLE public.booth_billing_settings ENABLE ROW LEVEL SECURITY;

INSERT INTO public.booth_billing_settings (stripe_livemode, vat_mode, pass_price_id, pass_amount_cents, annual_price_id, annual_amount_cents)
VALUES (false, 'franchise', 'price_1UOymJEbs46kbnkp933Sb6gM', 29000, 'price_1UOymLEbs46kbnkpFDVqtj6l', 149000);

-- =========================================================================
-- 2. Paiements
-- =========================================================================
CREATE TABLE public.booth_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exhibitor_id uuid NOT NULL REFERENCES public.exhibitors(id) ON DELETE RESTRICT,
  plan text NOT NULL CHECK (plan IN ('pass','annual')),
  event_id uuid REFERENCES public.events(id) ON DELETE SET NULL,
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  currency text NOT NULL,
  livemode boolean NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','expired','refunded','mismatch')),
  buyer_user_id uuid NOT NULL,
  buyer_email text,
  stripe_session_id text UNIQUE,
  stripe_payment_intent text,
  stripe_customer_id text,
  stripe_invoice_id text,
  invoice_url text,
  invoice_pdf text,
  valid_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (plan <> 'pass' OR event_id IS NOT NULL OR status <> 'pending')
);
CREATE INDEX booth_payments_exhibitor_idx ON public.booth_payments (exhibitor_id, created_at DESC);
CREATE INDEX booth_payments_pi_idx ON public.booth_payments (stripe_payment_intent) WHERE stripe_payment_intent IS NOT NULL;
COMMENT ON TABLE public.booth_payments IS 'Lotexpo Leads : paiements Stripe (Checkout). Écrit uniquement par les fonctions booth.';
ALTER TABLE public.booth_payments ENABLE ROW LEVEL SECURITY;

-- =========================================================================
-- 3. Préparation d'un paiement (administrateur de la fiche)
-- =========================================================================
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
  v_ex record;
  v_ev record;
  v_email text;
  v_pay public.booth_payments%ROWTYPE;
  v_recent integer;
BEGIN
  IF p_exhibitor_id IS NULL THEN RAISE EXCEPTION 'BOOTH_INVALID_INPUT'; END IF;
  SELECT id, name, slug INTO v_ex FROM public.exhibitors WHERE id = p_exhibitor_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'BOOTH_NOT_FOUND'; END IF;
  IF NOT public._booth_is_fiche_manager(p_exhibitor_id, v_uid) AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'BOOTH_FORBIDDEN';
  END IF;
  IF p_plan NOT IN ('pass','annual') THEN RAISE EXCEPTION 'BOOTH_INVALID_INPUT'; END IF;

  SELECT * INTO s FROM public.booth_billing_settings WHERE id;

  IF p_plan = 'pass' THEN
    IF p_event_id IS NULL THEN RAISE EXCEPTION 'BOOTH_INVALID_INPUT'; END IF;
    SELECT id, nom_event, date_debut, date_fin INTO v_ev FROM public.events WHERE id = p_event_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'BOOTH_INVALID_INPUT'; END IF;
    IF coalesce(v_ev.date_fin, v_ev.date_debut) IS NULL OR coalesce(v_ev.date_fin, v_ev.date_debut) < current_date THEN
      RAISE EXCEPTION 'BOOTH_EVENT_PAST';
    END IF;
  ELSIF p_event_id IS NOT NULL THEN
    RAISE EXCEPTION 'BOOTH_INVALID_INPUT';
  END IF;

  -- Déjà couvert : un Pass n'a pas de sens pendant un Annuel en cours
  SELECT * INTO v_access FROM public.booth_access WHERE exhibitor_id = p_exhibitor_id;
  IF FOUND AND p_plan = 'pass' AND v_access.status = 'approved' AND v_access.plan = 'annual'
     AND (v_access.plan_valid_until IS NULL OR v_access.plan_valid_until > now()) THEN
    RAISE EXCEPTION 'BOOTH_ALREADY_COVERED';
  END IF;
  IF FOUND AND v_access.status = 'revoked' THEN
    RAISE EXCEPTION 'BOOTH_FORBIDDEN';
  END IF;

  -- Garde-fou : 10 tentatives par fiche et par 24 h
  SELECT count(*) INTO v_recent FROM public.booth_payments
   WHERE exhibitor_id = p_exhibitor_id AND created_at > now() - interval '24 hours';
  IF v_recent >= 10 THEN RAISE EXCEPTION 'BOOTH_RATE_LIMITED'; END IF;

  SELECT u.email INTO v_email FROM auth.users u WHERE u.id = v_uid;

  INSERT INTO public.booth_payments (exhibitor_id, plan, event_id, amount_cents, currency, livemode, buyer_user_id, buyer_email)
  VALUES (p_exhibitor_id, p_plan, CASE WHEN p_plan = 'pass' THEN p_event_id END,
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
    'exhibitor_id', v_ex.id,
    'exhibitor_name', v_ex.name,
    'exhibitor_slug', v_ex.slug,
    'event_id', CASE WHEN p_plan = 'pass' THEN v_ev.id END,
    'event_name', CASE WHEN p_plan = 'pass' THEN v_ev.nom_event END
  );
END $$;

REVOKE ALL ON FUNCTION public.booth_checkout_prepare(uuid, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.booth_checkout_prepare(uuid, text, uuid) TO authenticated;

-- =========================================================================
-- 4. Fonctions réservées au service (fonctions Edge avec la clé de service)
-- =========================================================================
CREATE OR REPLACE FUNCTION public._booth_payment_attach(p_payment_id uuid, p_session_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.booth_payments
     SET stripe_session_id = p_session_id, updated_at = now()
   WHERE id = p_payment_id AND status = 'pending' AND stripe_session_id IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'BOOTH_NOT_FOUND'; END IF;
END $$;

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
    'buyer_user_id', p.buyer_user_id,
    'buyer_email', p.buyer_email,
    'amount_cents', p.amount_cents
  );
END $$;

CREATE OR REPLACE FUNCTION public._booth_payment_expire(p_session_id text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.booth_payments SET status = 'expired', updated_at = now()
   WHERE stripe_session_id = p_session_id AND status = 'pending';
$$;

-- Remboursement : le paiement est marqué, l'accès n'est PAS coupé automatiquement
-- (décision humaine : Thomas révoque depuis l'administration si besoin).
CREATE OR REPLACE FUNCTION public._booth_payment_refunded(p_payment_intent text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_ex uuid;
BEGIN
  UPDATE public.booth_payments SET status = 'refunded', updated_at = now()
   WHERE stripe_payment_intent = p_payment_intent AND status = 'paid'
   RETURNING id, exhibitor_id INTO v_id, v_ex;
  RETURN jsonb_build_object('payment_id', v_id, 'exhibitor_id', v_ex);
END $$;

REVOKE ALL ON FUNCTION public._booth_payment_attach(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._booth_payment_settle(text, text, integer, text, text, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._booth_payment_expire(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._booth_payment_refunded(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._booth_payment_attach(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public._booth_payment_settle(text, text, integer, text, text, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public._booth_payment_expire(text) TO service_role;
GRANT EXECUTE ON FUNCTION public._booth_payment_refunded(text) TO service_role;

-- =========================================================================
-- 5. Lecture pour l'espace exposant : offres, paiements et factures
-- =========================================================================
CREATE OR REPLACE FUNCTION public.booth_billing_overview(p_exhibitor_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := public._booth_require_user();
  s public.booth_billing_settings%ROWTYPE;
BEGIN
  IF NOT public._booth_is_fiche_manager(p_exhibitor_id, v_uid) AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'BOOTH_FORBIDDEN';
  END IF;
  SELECT * INTO s FROM public.booth_billing_settings WHERE id;
  RETURN jsonb_build_object(
    'livemode', s.stripe_livemode,
    'vat_mode', s.vat_mode,
    'currency', s.currency,
    'pass_amount_cents', s.pass_amount_cents,
    'annual_amount_cents', s.annual_amount_cents,
    'pass_grace_days', s.pass_grace_days,
    'payments', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'id', bp.id, 'plan', bp.plan, 'status', bp.status,
               'event_id', bp.event_id, 'event_name', e.nom_event,
               'amount_cents', bp.amount_cents, 'currency', bp.currency,
               'paid_at', bp.paid_at, 'valid_until', bp.valid_until,
               'invoice_url', bp.invoice_url, 'invoice_pdf', bp.invoice_pdf,
               'created_at', bp.created_at) ORDER BY bp.created_at DESC)
        FROM public.booth_payments bp
        LEFT JOIN public.events e ON e.id = bp.event_id
       WHERE bp.exhibitor_id = p_exhibitor_id AND bp.status IN ('paid','refunded')
    ), '[]'::jsonb)
  );
END $$;

REVOKE ALL ON FUNCTION public.booth_billing_overview(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.booth_billing_overview(uuid) TO authenticated;

-- =========================================================================
-- 6. Limite de 15 comptes au total, administrateurs de la fiche compris
--    (corps identique à la version en place, seul le calcul des sièges change)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.booth_invite_member(p_exhibitor_id uuid, p_email text, p_role text DEFAULT 'field'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := public._booth_require_user();
  v_email text := lower(btrim(coalesce(p_email,'')));
  v_token text;
  v_hash text;
  v_expires timestamptz := now() + interval '14 days';
  v_seats integer;
  v_member public.booth_team_members%ROWTYPE;
  v_existing_user uuid;
BEGIN
  IF public.booth_role(p_exhibitor_id) IS DISTINCT FROM 'manager' THEN
    RAISE EXCEPTION 'BOOTH_FORBIDDEN';
  END IF;
  IF NOT public._booth_is_paid(p_exhibitor_id) THEN
    RAISE EXCEPTION 'BOOTH_PLAN_REQUIRED';
  END IF;
  IF p_role NOT IN ('manager','field') THEN
    RAISE EXCEPTION 'BOOTH_INVALID_INPUT';
  END IF;
  IF v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' OR length(v_email) > 254 THEN
    RAISE EXCEPTION 'BOOTH_INVALID_INPUT';
  END IF;

  -- Déjà membre actif (par compte existant) ou owner/admin de la fiche ?
  SELECT u.id INTO v_existing_user FROM auth.users u WHERE lower(u.email) = v_email LIMIT 1;
  IF v_existing_user IS NOT NULL AND (
       public._booth_is_fiche_manager(p_exhibitor_id, v_existing_user)
       OR EXISTS (SELECT 1 FROM public.booth_team_members m
                  WHERE m.exhibitor_id = p_exhibitor_id AND m.user_id = v_existing_user AND m.status = 'active')) THEN
    RAISE EXCEPTION 'BOOTH_ALREADY_MEMBER';
  END IF;

  -- Limite : 15 comptes au total = administrateurs actifs de la fiche
  -- + membres actifs + invitations en cours (hors réinvitation de la même adresse)
  SELECT count(*) INTO v_seats FROM public.booth_team_members m
   WHERE m.exhibitor_id = p_exhibitor_id
     AND (m.status = 'active' OR (m.status = 'invited' AND m.invite_expires_at > now()))
     AND m.invited_email IS DISTINCT FROM v_email;
  v_seats := v_seats + (SELECT count(*) FROM public.exhibitor_team_members t
                         WHERE t.exhibitor_id = p_exhibitor_id AND t.status = 'active' AND t.role IN ('owner','admin'));
  IF v_seats >= 15 THEN
    RAISE EXCEPTION 'BOOTH_SEATS_FULL';
  END IF;

  v_token := encode(extensions.gen_random_bytes(24), 'hex');
  v_hash  := encode(extensions.digest(v_token, 'sha256'), 'hex');

  SELECT * INTO v_member FROM public.booth_team_members m
   WHERE m.exhibitor_id = p_exhibitor_id AND m.status = 'invited' AND m.invited_email = v_email
   FOR UPDATE;

  IF FOUND THEN
    UPDATE public.booth_team_members
       SET invite_token_hash = v_hash, invite_expires_at = v_expires, role = p_role, invited_by = v_uid
     WHERE id = v_member.id
     RETURNING * INTO v_member;
  ELSE
    INSERT INTO public.booth_team_members (exhibitor_id, invited_email, invite_token_hash, invite_expires_at, role, status, invited_by)
    VALUES (p_exhibitor_id, v_email, v_hash, v_expires, p_role, 'invited', v_uid)
    RETURNING * INTO v_member;
  END IF;

  RETURN jsonb_build_object(
    'member_id', v_member.id,
    'token', v_token,
    'expires_at', v_member.invite_expires_at,
    'email', v_email,
    'role', v_member.role
  );
END $function$;
