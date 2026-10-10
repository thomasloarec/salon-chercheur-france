-- Lotexpo Leads, lot P2 : Annuel à 720 € (rentable dès 3 salons), lien de rendez-vous de prise en main,
-- notification in-app aux admins Lotexpo à chaque paiement.

-- 1. Nouveau prix de l'Annuel (prix Stripe de test créé le 10/10, l'ancien à 1 490 € est archivé)
UPDATE public.booth_billing_settings
   SET annual_price_id = 'price_1UP4n4Ebs46kbnkpcLzcOwiP',
       annual_amount_cents = 72000,
       updated_at = now()
 WHERE id;

-- 2. Lien de prise de rendez-vous (Calendly) proposé après paiement, modifiable sans code
ALTER TABLE public.booth_billing_settings
  ADD COLUMN onboarding_booking_url text CHECK (onboarding_booking_url IS NULL OR onboarding_booking_url ~ '^https://');
COMMENT ON COLUMN public.booth_billing_settings.onboarding_booking_url IS
  'Lotexpo Leads : lien de prise de rendez-vous (présentation et prise en main avec Thomas) proposé après un paiement. Null = rien affiché.';

-- 3. Type de notification in-app « paiement Lotexpo Leads »
ALTER TABLE public.notifications DROP CONSTRAINT notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK ((type = ANY (ARRAY[
  'like'::text, 'comment'::text, 'reply'::text, 'new_lead_brochure'::text, 'new_lead_rdv'::text, 'new_novelty_on_favorite'::text,
  'event_reminder_7d'::text, 'event_reminder_1d'::text, 'novelty_approved'::text, 'novelty_rejected'::text, 'plan_limit_reached'::text,
  'welcome'::text, 'complete_profile'::text, 'password_changed'::text, 'suspicious_activity'::text, 'recommended_event'::text,
  'inactivity_reminder'::text, 'radar_new_matches'::text, 'claim_approved'::text, 'claim_request'::text, 'novelty_visit_milestone'::text,
  'radar_salon_live'::text, 'radar_salon_debrief'::text, 'radar_task_due'::text, 'radar_prep_reminder'::text, 'radar_hot_prospect'::text,
  'event_claim_request'::text, 'event_change_request'::text, 'event_claim_approved'::text, 'event_claim_rejected'::text,
  'event_change_approved'::text, 'event_change_rejected'::text, 'participation_request'::text, 'participation_approved'::text,
  'participation_rejected'::text, 'support_new_thread'::text, 'support_reply'::text, 'support_escalated'::text, 'site_health'::text,
  'novelty_submitted'::text, 'novelty_resubmitted'::text, 'booth_access_request'::text, 'booth_payment_paid'::text
])));

-- 4. booth_billing_overview renvoie aussi le lien de rendez-vous (corps identique, une clé ajoutée)
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
    'onboarding_booking_url', s.onboarding_booking_url,
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
