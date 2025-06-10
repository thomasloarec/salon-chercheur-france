
-- Table référentiel des entreprises
CREATE TABLE public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  website text,
  siret text,
  created_at timestamp with time zone DEFAULT now()
);

-- Table des exposants déclarés par scraping
CREATE TABLE public.event_exhibitors (
  event_id uuid REFERENCES public.events(id) ON DELETE CASCADE,
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  stand text,
  source_url text,
  scraped_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (event_id, company_id)
);

-- Table des entreprises suivies par l'utilisateur
CREATE TABLE public.user_companies (
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  relation text CHECK (relation IN ('client', 'prospect', 'fournisseur')),
  created_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (user_id, company_id)
);

-- Table pour les correspondances (au lieu d'une vue matérialisée)
CREATE TABLE public.exhibitor_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id uuid REFERENCES public.events(id) ON DELETE CASCADE,
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  relation text CHECK (relation IN ('client', 'prospect', 'fournisseur')),
  stand text,
  created_at timestamp with time zone DEFAULT now()
);

-- Index pour optimiser les performances
CREATE INDEX idx_event_exhibitors_event_id ON public.event_exhibitors(event_id);
CREATE INDEX idx_event_exhibitors_company_id ON public.event_exhibitors(company_id);
CREATE INDEX idx_user_companies_user_company ON public.user_companies(user_id, company_id);
CREATE INDEX idx_exhibitor_matches_user_id ON public.exhibitor_matches(user_id);
CREATE INDEX idx_exhibitor_matches_event_id ON public.exhibitor_matches(event_id);

-- Activation de RLS pour user_companies
ALTER TABLE public.user_companies ENABLE ROW LEVEL SECURITY;

-- Politique RLS pour user_companies : un utilisateur ne peut accéder qu'à ses propres lignes
CREATE POLICY "Users can manage their own companies" 
  ON public.user_companies 
  FOR ALL 
  USING (auth.uid() = user_id);

-- Activation de RLS pour exhibitor_matches
ALTER TABLE public.exhibitor_matches ENABLE ROW LEVEL SECURITY;

-- Politique RLS pour exhibitor_matches : un utilisateur ne peut voir que ses propres correspondances
CREATE POLICY "Users can view their own exhibitor matches" 
  ON public.exhibitor_matches 
  FOR ALL 
  USING (auth.uid() = user_id);

-- Les tables companies et event_exhibitors restent publiques en lecture pour permettre la découverte
-- mais nous pouvons ajouter des politiques restrictives pour l'écriture si nécessaire plus tard
