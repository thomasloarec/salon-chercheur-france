-- Étendre la table crm_connections pour supporter le système de claim
-- Ajouter les nouveaux champs pour gérer les connexions non réclamées

ALTER TABLE public.crm_connections 
ADD COLUMN status text DEFAULT 'active' CHECK (status IN ('unclaimed', 'active', 'revoked')),
ADD COLUMN provider_user_id text,
ADD COLUMN email_from_crm text,
ADD COLUMN claim_token text UNIQUE,
ADD COLUMN claim_token_expires_at timestamp with time zone;

-- Modifier user_id pour permettre NULL (connexions non réclamées)
ALTER TABLE public.crm_connections 
ALTER COLUMN user_id DROP NOT NULL;

-- Index pour optimiser les recherches
CREATE INDEX IF NOT EXISTS idx_crm_connections_claim_token ON public.crm_connections(claim_token) WHERE claim_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_crm_connections_user_id ON public.crm_connections(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_crm_connections_provider_user ON public.crm_connections(provider, provider_user_id) WHERE provider_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_crm_connections_status ON public.crm_connections(status);

-- Mettre à jour les politiques RLS pour gérer le nouveau système
DROP POLICY IF EXISTS "read_own_crm" ON public.crm_connections;
DROP POLICY IF EXISTS "update_own_crm" ON public.crm_connections;
DROP POLICY IF EXISTS "delete_own_crm" ON public.crm_connections;

-- Nouvelles politiques RLS
CREATE POLICY "Users can read their active CRM connections" 
ON public.crm_connections FOR SELECT 
USING (
  (auth.uid() = user_id AND status != 'unclaimed') 
  OR 
  is_admin()
);

CREATE POLICY "Users can update their CRM connections" 
ON public.crm_connections FOR UPDATE 
USING (auth.uid() = user_id AND status != 'unclaimed');

CREATE POLICY "Users can delete their CRM connections" 
ON public.crm_connections FOR DELETE 
USING (auth.uid() = user_id AND status != 'unclaimed');

CREATE POLICY "Service role can manage CRM connections" 
ON public.crm_connections FOR ALL 
USING (auth.role() = 'service_role');

-- Fonction pour nettoyer les claim_tokens expirés
CREATE OR REPLACE FUNCTION public.cleanup_expired_claim_tokens()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  UPDATE public.crm_connections 
  SET status = 'revoked',
      claim_token = NULL,
      claim_token_expires_at = NULL
  WHERE status = 'unclaimed' 
    AND claim_token_expires_at < now();
END;
$$;