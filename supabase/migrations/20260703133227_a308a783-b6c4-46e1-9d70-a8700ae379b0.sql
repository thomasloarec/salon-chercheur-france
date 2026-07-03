ALTER TABLE public.radar_email_log DROP CONSTRAINT IF EXISTS radar_email_log_email_type_check;

ALTER TABLE public.radar_email_log ADD CONSTRAINT radar_email_log_email_type_check
  CHECK (email_type = ANY (ARRAY[
    'radar_digest'::text,
    'trial_ending'::text,
    'teaser'::text,
    'radar_detection'::text,
    'radar_reminder'::text,
    'radar_salon_live'::text,
    'radar_salon_debrief'::text,
    'radar_task_due'::text,
    'radar_prep_reminder'::text,
    'radar_hot_prospect'::text
  ]));