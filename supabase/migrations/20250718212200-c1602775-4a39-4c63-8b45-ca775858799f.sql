
-- 1. Renommer les colonnes de la table exposants
ALTER TABLE public.exposants RENAME COLUMN exposant_nom TO nom_exposant;
ALTER TABLE public.exposants RENAME COLUMN exposant_website TO website_exposant;

-- 2. Ajouter la colonne id_exposant (clé fonctionnelle d'Airtable)
ALTER TABLE public.exposants ADD COLUMN id_exposant TEXT UNIQUE;

-- 3. Supprimer la colonne stand (sera dans participation)
ALTER TABLE public.exposants DROP COLUMN exposant_stand;

-- 4. Créer la nouvelle table participation (many-to-many)
CREATE TABLE public.participation (
  id_participation UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  id_event         UUID  NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  id_exposant      TEXT  NOT NULL REFERENCES public.exposants(id_exposant) ON DELETE CASCADE,
  stand_exposant   TEXT,
  website_exposant TEXT,
  urlexpo_event    TEXT,
  created_at       TIMESTAMPTZ DEFAULT now()
);

-- 5. Index pour les jointures rapides
CREATE INDEX ON public.participation (id_event);
CREATE INDEX ON public.participation (id_exposant);

-- 6. Contrainte unique pour éviter les doublons participation/événement
ALTER TABLE public.participation ADD CONSTRAINT unique_exposant_event 
UNIQUE (id_event, id_exposant);

-- 7. RLS pour la table participation
ALTER TABLE public.participation ENABLE ROW LEVEL SECURITY;

-- Policy de lecture publique pour participation
CREATE POLICY "Allow public read access to participation" ON public.participation
FOR SELECT USING (true);

-- Policy pour permettre aux utilisateurs authentifiés de gérer participation
CREATE POLICY "Allow authenticated users to manage participation" ON public.participation
FOR ALL USING (auth.uid() IS NOT NULL);
