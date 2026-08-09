-- Harnais d'evaluation hors production de la Recherche IA.
-- Chaque ligne = un run complet de l'agent sur un cas de test, avec la trace des outils appeles.
-- Aucune donnee utilisateur, aucun lien vers auth.users.

CREATE TABLE IF NOT EXISTS public.ai_eval_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_label text NOT NULL,
  model text NOT NULL,
  case_id text NOT NULL,
  question text NOT NULL,
  attempt integer NOT NULL DEFAULT 1,
  tool_calls jsonb NOT NULL DEFAULT '[]'::jsonb,
  n_iters integer,
  final_text text,
  cited_event_slugs text[] NOT NULL DEFAULT '{}',
  retrieved_event_slugs text[] NOT NULL DEFAULT '{}',
  cited_exhibitor_count integer NOT NULL DEFAULT 0,
  latency_ms integer,
  input_tokens integer,
  output_tokens integer,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.ai_eval_runs IS
  'Harnais d''evaluation hors production de la Recherche IA. Chaque ligne = un run complet de l''agent sur un cas de test, avec la trace des outils appeles. Aucune donnee utilisateur, aucun lien vers auth.users.';

CREATE INDEX IF NOT EXISTS idx_ai_eval_runs_label_model
  ON public.ai_eval_runs (run_label, model, case_id);

ALTER TABLE public.ai_eval_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage ai_eval_runs" ON public.ai_eval_runs;
CREATE POLICY "Admins manage ai_eval_runs"
  ON public.ai_eval_runs FOR ALL
  USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Service role manages ai_eval_runs" ON public.ai_eval_runs;
CREATE POLICY "Service role manages ai_eval_runs"
  ON public.ai_eval_runs FOR ALL
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
