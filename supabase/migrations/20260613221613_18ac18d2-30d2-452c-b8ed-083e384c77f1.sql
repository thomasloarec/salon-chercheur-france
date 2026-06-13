-- 1. Table novelty_visit_milestones
CREATE TABLE public.novelty_visit_milestones (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  novelty_id    uuid NOT NULL REFERENCES public.novelties(id) ON DELETE CASCADE,
  threshold     integer NOT NULL,
  notified_at   timestamptz,
  email_sent_at timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT novelty_visit_milestones_unique UNIQUE (novelty_id, threshold)
);

CREATE INDEX idx_novelty_visit_milestones_novelty
  ON public.novelty_visit_milestones(novelty_id);

-- 2. Grants (table interne : admin + service_role uniquement)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.novelty_visit_milestones TO authenticated;
GRANT ALL ON public.novelty_visit_milestones TO service_role;

-- RLS
ALTER TABLE public.novelty_visit_milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage novelty visit milestones"
  ON public.novelty_visit_milestones
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- 3. Étendre le CHECK notifications_type_check (liste existante + nouvelle valeur)
ALTER TABLE public.notifications DROP CONSTRAINT notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check
  CHECK (type = ANY (ARRAY[
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
    'radar_new_matches'::text,
    'claim_approved'::text,
    'claim_request'::text,
    'novelty_visit_milestone'::text
  ]));