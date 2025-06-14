
-- Créer la table pour les abonnements newsletter
CREATE TABLE public.newsletter_subscriptions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email text NOT NULL UNIQUE,
  sectors uuid[] NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Activer RLS sur la table
ALTER TABLE public.newsletter_subscriptions ENABLE ROW LEVEL SECURITY;

-- Politique pour permettre l'insertion publique (pour l'abonnement)
CREATE POLICY "Allow public newsletter subscription"
  ON public.newsletter_subscriptions
  FOR INSERT
  WITH CHECK (true);

-- Politique pour permettre la lecture publique (pour la gestion des doublons)
CREATE POLICY "Allow public newsletter read for duplicates"
  ON public.newsletter_subscriptions
  FOR SELECT
  USING (true);

-- Politique pour permettre la mise à jour publique (pour la fusion des secteurs)
CREATE POLICY "Allow public newsletter update"
  ON public.newsletter_subscriptions
  FOR UPDATE
  USING (true);

-- Ajouter index pour optimiser les requêtes
CREATE INDEX idx_newsletter_email ON public.newsletter_subscriptions(email);
CREATE INDEX idx_newsletter_sectors ON public.newsletter_subscriptions USING GIN(sectors);
