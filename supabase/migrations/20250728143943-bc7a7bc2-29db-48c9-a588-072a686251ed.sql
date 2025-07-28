-- Création des tables pour la sécurité et logging

-- 1. Table pour les logs d'application
CREATE TABLE public.application_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  level text NOT NULL CHECK (level IN ('info', 'warn', 'error', 'debug')),
  message text NOT NULL,
  details jsonb,
  source text NOT NULL, -- 'edge-function', 'frontend', etc.
  function_name text, -- nom de la fonction edge si applicable
  user_id uuid, -- optionnel, si l'action est liée à un utilisateur
  ip_address text,
  user_agent text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Index pour les performances
CREATE INDEX idx_application_logs_level ON public.application_logs(level);
CREATE INDEX idx_application_logs_created_at ON public.application_logs(created_at);
CREATE INDEX idx_application_logs_source ON public.application_logs(source);
CREATE INDEX idx_application_logs_user_id ON public.application_logs(user_id) WHERE user_id IS NOT NULL;

-- 2. Table pour les tokens CSRF
CREATE TABLE public.csrf_tokens (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  token text NOT NULL UNIQUE,
  user_id uuid NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Index pour les performances
CREATE INDEX idx_csrf_tokens_token ON public.csrf_tokens(token);
CREATE INDEX idx_csrf_tokens_user_id ON public.csrf_tokens(user_id);
CREATE INDEX idx_csrf_tokens_expires_at ON public.csrf_tokens(expires_at);

-- 3. Activer RLS sur les deux tables
ALTER TABLE public.application_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.csrf_tokens ENABLE ROW LEVEL SECURITY;

-- 4. Politiques RLS pour application_logs
-- Seuls les admins peuvent voir tous les logs
CREATE POLICY "Admins can view all logs"
  ON public.application_logs
  FOR SELECT
  TO authenticated
  USING (is_admin());

-- Les edge functions peuvent insérer des logs (via service role)
CREATE POLICY "Service role can insert logs"
  ON public.application_logs
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- 5. Politiques RLS précises pour csrf_tokens
-- SELECT uniquement sur ses propres tokens
CREATE POLICY "Users can select their tokens"
  ON public.csrf_tokens
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- INSERT/UPDATE/DELETE seulement sur ses propres tokens
CREATE POLICY "Users can modify their tokens"
  ON public.csrf_tokens
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their tokens"
  ON public.csrf_tokens
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their tokens"
  ON public.csrf_tokens
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- 6. Fonction de cleanup sécurisée avec SET search_path
CREATE OR REPLACE FUNCTION public.cleanup_expired_csrf_tokens()
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  DELETE FROM public.csrf_tokens 
  WHERE expires_at < now();
END;
$$;

-- 7. Fonction pour logger depuis les edge functions
CREATE OR REPLACE FUNCTION public.log_application_event(
  p_level text,
  p_message text,
  p_details jsonb DEFAULT NULL,
  p_source text DEFAULT 'edge-function',
  p_function_name text DEFAULT NULL,
  p_user_id uuid DEFAULT NULL,
  p_ip_address text DEFAULT NULL,
  p_user_agent text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.application_logs (
    level, message, details, source, function_name, 
    user_id, ip_address, user_agent
  ) VALUES (
    p_level, p_message, p_details, p_source, p_function_name,
    p_user_id, p_ip_address, p_user_agent
  );
END;
$$;