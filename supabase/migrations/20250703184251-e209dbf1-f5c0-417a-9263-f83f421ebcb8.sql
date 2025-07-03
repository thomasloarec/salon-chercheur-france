-- Création de la table events_import pour les données Google Sheets
CREATE TABLE public.events_import (
  id TEXT PRIMARY KEY,
  nom_event TEXT,
  status_event TEXT,
  ai_certainty TEXT,
  type_event TEXT,
  date_debut TEXT,
  date_fin TEXT,
  date_complete TEXT,
  secteur TEXT,
  url_image TEXT,
  url_site_officiel TEXT,
  description_event TEXT,
  affluence TEXT,
  tarifs TEXT,
  nom_lieu TEXT,
  adresse TEXT,
  chatgpt_prompt TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Création de la table exposants
CREATE TABLE public.exposants (
  id SERIAL PRIMARY KEY,
  id_event TEXT NOT NULL,
  exposant_nom TEXT,
  exposant_stand TEXT,
  exposant_website TEXT,
  exposant_description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  FOREIGN KEY (id_event) REFERENCES public.events_import(id) ON DELETE CASCADE
);

-- Enable RLS
ALTER TABLE public.events_import ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exposants ENABLE ROW LEVEL SECURITY;

-- Policies pour events_import
CREATE POLICY "Allow public read access to events_import" 
ON public.events_import 
FOR SELECT 
USING (true);

CREATE POLICY "Allow authenticated users to manage events_import" 
ON public.events_import 
FOR ALL 
USING (auth.uid() IS NOT NULL);

-- Policies pour exposants
CREATE POLICY "Allow public read access to exposants" 
ON public.exposants 
FOR SELECT 
USING (true);

CREATE POLICY "Allow authenticated users to manage exposants" 
ON public.exposants 
FOR ALL 
USING (auth.uid() IS NOT NULL);

-- Trigger pour updated_at
CREATE TRIGGER update_events_import_updated_at
BEFORE UPDATE ON public.events_import
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();