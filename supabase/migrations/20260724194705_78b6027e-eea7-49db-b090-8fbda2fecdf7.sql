CREATE TABLE IF NOT EXISTS public.ai_editorial_prompts (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action              text NOT NULL CHECK (action IN ('analyser', 'generer')),
  version             int  NOT NULL,
  prompt              text NOT NULL,
  model_validated_on  text,
  actif               boolean NOT NULL DEFAULT false,
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (action, version)
);

GRANT ALL ON public.ai_editorial_prompts TO service_role;

CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_editorial_prompts_actif
  ON public.ai_editorial_prompts (action)
  WHERE actif = true;

ALTER TABLE public.ai_editorial_prompts ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.ai_editorial_prompts IS
  'Prompts système versionnés de novelty-ai-draft. Le prompt est un bloc validé dans son ensemble sur le jeu d''essai : il est servi tel quel, jamais recomposé à partir de fragments.';

CREATE OR REPLACE FUNCTION public.get_active_editorial_prompt(p_action text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT jsonb_build_object(
    'version', version,
    'prompt',  prompt,
    'model_validated_on', model_validated_on
  )
  FROM public.ai_editorial_prompts
  WHERE action = p_action AND actif = true
  LIMIT 1;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_active_editorial_prompt(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_active_editorial_prompt(text) FROM anon;
GRANT  EXECUTE ON FUNCTION public.get_active_editorial_prompt(text) TO service_role, postgres;