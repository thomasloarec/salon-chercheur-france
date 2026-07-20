CREATE TABLE IF NOT EXISTS public.event_ai (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id     uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  accroche     text,
  generated_at timestamptz,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id)
);

CREATE INDEX IF NOT EXISTS idx_event_ai_event_id ON public.event_ai(event_id);

GRANT SELECT ON public.event_ai TO anon;
GRANT SELECT ON public.event_ai TO authenticated;
GRANT ALL ON public.event_ai TO service_role;

ALTER TABLE public.event_ai ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read event_ai"
  ON public.event_ai FOR SELECT
  USING (true);

CREATE POLICY "Admins manage event_ai"
  ON public.event_ai FOR ALL
  USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "Service role manages event_ai"
  ON public.event_ai FOR ALL
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');