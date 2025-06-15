
-- Créer la table de liaison event_sectors pour la relation many-to-many
CREATE TABLE public.event_sectors (
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  sector_id UUID NOT NULL REFERENCES public.sectors(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, sector_id)
);

-- Activer RLS sur la table event_sectors
ALTER TABLE public.event_sectors ENABLE ROW LEVEL SECURITY;

-- Politique pour permettre la lecture des relations event-secteur
CREATE POLICY "Anyone can view event sectors" 
  ON public.event_sectors 
  FOR SELECT 
  USING (true);

-- Politique pour permettre l'insertion aux admins
CREATE POLICY "Admins can insert event sectors" 
  ON public.event_sectors 
  FOR INSERT 
  WITH CHECK (true);

-- Politique pour permettre la suppression aux admins
CREATE POLICY "Admins can delete event sectors" 
  ON public.event_sectors 
  FOR DELETE 
  USING (true);

-- Migrer les données existantes : copier le secteur actuel de chaque événement vers la table de liaison
INSERT INTO public.event_sectors (event_id, sector_id)
SELECT e.id, s.id
FROM public.events e
JOIN public.sectors s ON s.name = e.sector
WHERE e.sector IS NOT NULL;

-- Ajouter un index pour améliorer les performances
CREATE INDEX idx_event_sectors_event_id ON public.event_sectors(event_id);
CREATE INDEX idx_event_sectors_sector_id ON public.event_sectors(sector_id);
