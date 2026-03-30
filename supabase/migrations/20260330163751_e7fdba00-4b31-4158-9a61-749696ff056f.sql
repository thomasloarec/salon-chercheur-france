
-- Table de tracking des sessions wizard "Préparer ma visite"
CREATE TABLE public.wizard_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES public.events(id),
  user_id uuid REFERENCES auth.users(id),
  step_reached text NOT NULL DEFAULT 'opened',
  role text,
  objectif text,
  keywords text[],
  duration text,
  nb_prioritaires integer,
  nb_optionnels integer,
  ai_duration_ms integer,
  ai_error text,
  auth_shown boolean DEFAULT false,
  auth_success boolean DEFAULT false,
  auth_method text,
  saved boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

-- RLS
ALTER TABLE public.wizard_sessions ENABLE ROW LEVEL SECURITY;

-- INSERT public (anonymous tracking)
CREATE POLICY "Anyone can insert wizard sessions"
  ON public.wizard_sessions
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- UPDATE: allow anyone to update their own session (by matching the id they hold in memory)
CREATE POLICY "Anyone can update wizard sessions"
  ON public.wizard_sessions
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- SELECT: admin only via has_role
CREATE POLICY "Admins can read wizard sessions"
  ON public.wizard_sessions
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Index for dashboard queries
CREATE INDEX idx_wizard_sessions_event_id ON public.wizard_sessions(event_id);
CREATE INDEX idx_wizard_sessions_created_at ON public.wizard_sessions(created_at);
CREATE INDEX idx_wizard_sessions_step ON public.wizard_sessions(step_reached);
