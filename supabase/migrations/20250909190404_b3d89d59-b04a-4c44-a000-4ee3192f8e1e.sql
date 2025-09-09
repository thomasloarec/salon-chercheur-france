-- Migration: Normaliser newsletter_subscriptions avec unicité (email, sector_id)
-- Passer d'un modèle avec array sectors vers un modèle une ligne par (email, sector_id)

-- 1. Créer une table temporaire avec le nouveau schéma
CREATE TABLE public.newsletter_subscriptions_new (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email text NOT NULL,
  sector_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  verified boolean DEFAULT false,
  ip_address inet,
  
  -- Contrainte d'unicité composite (email, sector_id)
  CONSTRAINT newsletter_subscriptions_email_sector_id_key UNIQUE (email, sector_id),
  
  -- Clé étrangère vers sectors
  CONSTRAINT newsletter_subscriptions_sector_id_fkey 
    FOREIGN KEY (sector_id) REFERENCES public.sectors(id) ON DELETE CASCADE
);

-- 2. Migrer les données existantes (décomposer les arrays en lignes individuelles)
INSERT INTO public.newsletter_subscriptions_new (email, sector_id, created_at, verified, ip_address)
SELECT 
  ns.email,
  s.id as sector_id,
  ns.created_at,
  ns.verified,
  ns.ip_address
FROM public.newsletter_subscriptions ns
CROSS JOIN LATERAL unnest(ns.sectors) AS sector_name(name)
JOIN public.sectors s ON s.name = sector_name.name
WHERE ns.sectors IS NOT NULL AND array_length(ns.sectors, 1) > 0;

-- 3. Remplacer l'ancienne table par la nouvelle
DROP TABLE public.newsletter_subscriptions;
ALTER TABLE public.newsletter_subscriptions_new RENAME TO newsletter_subscriptions;

-- 4. Créer des index pour les performances
CREATE INDEX newsletter_subscriptions_email_idx ON public.newsletter_subscriptions (email);
CREATE INDEX newsletter_subscriptions_sector_id_idx ON public.newsletter_subscriptions (sector_id);

-- 5. Activer RLS sur la nouvelle table
ALTER TABLE public.newsletter_subscriptions ENABLE ROW LEVEL SECURITY;

-- 6. Recréer les politiques RLS
CREATE POLICY "Allow public newsletter subscription" 
ON public.newsletter_subscriptions 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Service role newsletter read" 
ON public.newsletter_subscriptions 
FOR SELECT 
USING (auth.role() = 'service_role'::text);

CREATE POLICY "Service role only newsletter update" 
ON public.newsletter_subscriptions 
FOR UPDATE 
USING (auth.role() = 'service_role'::text);

CREATE POLICY "Admins can read newsletter subscriptions" 
ON public.newsletter_subscriptions 
FOR SELECT 
USING (is_admin());

-- 7. Permettre aux utilisateurs connectés de gérer leurs propres abonnements
CREATE POLICY "Users can manage their own newsletter subscriptions" 
ON public.newsletter_subscriptions 
FOR ALL
USING (
  auth.uid() IS NOT NULL AND 
  email = (SELECT email FROM auth.users WHERE id = auth.uid())
)
WITH CHECK (
  auth.uid() IS NOT NULL AND 
  email = (SELECT email FROM auth.users WHERE id = auth.uid())
);