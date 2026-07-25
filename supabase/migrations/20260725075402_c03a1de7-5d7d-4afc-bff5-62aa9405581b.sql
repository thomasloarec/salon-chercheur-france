CREATE TABLE IF NOT EXISTS public.novelty_ai_generation_log (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id     uuid NOT NULL,
  action      text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.novelty_ai_generation_log TO service_role;

CREATE INDEX IF NOT EXISTS idx_novelty_ai_gen_log_user_time
  ON public.novelty_ai_generation_log (user_id, created_at DESC);

ALTER TABLE public.novelty_ai_generation_log ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.novelty_ai_generation_log IS
  'Journal anti-rafale des appels à novelty-ai-draft. N''est PAS un compteur de crédits métier : sert uniquement à freiner l''automatisation. 30 appels/heure/utilisateur.';

CREATE OR REPLACE FUNCTION public.novelty_ai_rate_check(p_user_id uuid, p_action text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  c_limite      constant int := 30;
  c_fenetre     constant interval := interval '1 hour';
  v_count       int;
  v_oldest      timestamptz;
  v_minutes     int;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('autorise', true, 'restant', c_limite, 'limite', c_limite);
  END IF;

  SELECT count(*), min(created_at)
  INTO v_count, v_oldest
  FROM public.novelty_ai_generation_log
  WHERE user_id = p_user_id
    AND created_at > now() - c_fenetre;

  IF v_count >= c_limite THEN
    v_minutes := GREATEST(1, ceil(extract(epoch FROM (v_oldest + c_fenetre - now())) / 60)::int);
    RETURN jsonb_build_object(
      'autorise', false,
      'restant', 0,
      'limite', c_limite,
      'minutes_avant_reouverture', v_minutes
    );
  END IF;

  INSERT INTO public.novelty_ai_generation_log (user_id, action)
  VALUES (p_user_id, p_action);

  RETURN jsonb_build_object(
    'autorise', true,
    'restant', c_limite - v_count - 1,
    'limite', c_limite
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.novelty_ai_rate_check(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.novelty_ai_rate_check(uuid, text) TO service_role, postgres;