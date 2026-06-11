ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK (type = ANY (ARRAY[
  'like','comment','reply','new_lead_brochure','new_lead_rdv','new_novelty_on_favorite',
  'event_reminder_7d','event_reminder_1d','novelty_approved','novelty_rejected',
  'plan_limit_reached','welcome','complete_profile','password_changed','suspicious_activity',
  'recommended_event','inactivity_reminder','radar_new_matches','claim_approved'
]));