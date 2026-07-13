CREATE TABLE public.ai_rate_limit_hits (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ip_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.ai_rate_limit_hits TO service_role;

CREATE INDEX idx_ai_rl_hash_created ON public.ai_rate_limit_hits (ip_hash, created_at);

ALTER TABLE public.ai_rate_limit_hits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rl_service_role_all" ON public.ai_rate_limit_hits
  FOR ALL TO public
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');