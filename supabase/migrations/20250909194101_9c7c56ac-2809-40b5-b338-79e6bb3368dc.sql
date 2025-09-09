-- Activer RLS si pas déjà
ALTER TABLE public.newsletter_subscriptions ENABLE ROW LEVEL SECURITY;

-- Supprimer anciennes policies ambiguës
DROP POLICY IF EXISTS "newsletter_subscriptions_rw" ON public.newsletter_subscriptions;
DROP POLICY IF EXISTS "Users manage their subscriptions" ON public.newsletter_subscriptions;

-- Politique unique : l'utilisateur authentifié ne peut voir/écrire/supprimer que ses lignes
CREATE POLICY "Users manage their own newsletter_subscriptions"
ON public.newsletter_subscriptions
FOR ALL
TO authenticated
USING (
  email = (current_setting('request.jwt.claims', true)::jsonb ->> 'email')
)
WITH CHECK (
  email = (current_setting('request.jwt.claims', true)::jsonb ->> 'email')
);