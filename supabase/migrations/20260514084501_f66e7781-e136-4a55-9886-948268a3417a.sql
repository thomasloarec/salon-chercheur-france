ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK (
  type = ANY (ARRAY[
    'like'::text,
    'comment'::text,
    'reply'::text,
    'new_lead_brochure'::text,
    'new_lead_rdv'::text,
    'new_novelty_on_favorite'::text,
    'event_reminder_7d'::text,
    'event_reminder_1d'::text,
    'novelty_approved'::text,
    'novelty_rejected'::text,
    'plan_limit_reached'::text,
    'welcome'::text,
    'complete_profile'::text,
    'password_changed'::text,
    'suspicious_activity'::text,
    'recommended_event'::text,
    'inactivity_reminder'::text,
    'radar_new_matches'::text
  ])
);