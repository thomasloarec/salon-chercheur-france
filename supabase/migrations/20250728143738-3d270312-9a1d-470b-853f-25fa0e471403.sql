-- Corrections pour la sécurité des fonctions CSRF et RLS

-- 1. Corriger la fonction cleanup avec SET search_path
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

-- 2. Supprimer l'ancienne politique générale sur csrf_tokens
DROP POLICY IF EXISTS "Users can manage their own CSRF tokens" ON public.csrf_tokens;

-- 3. Créer des politiques RLS plus précises
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