
-- Ajouter le champ visible à la table events
ALTER TABLE public.events 
ADD COLUMN IF NOT EXISTS visible boolean DEFAULT true;

-- Mettre à jour tous les événements existants pour qu'ils soient visibles par défaut
UPDATE public.events 
SET visible = true 
WHERE visible IS NULL;
