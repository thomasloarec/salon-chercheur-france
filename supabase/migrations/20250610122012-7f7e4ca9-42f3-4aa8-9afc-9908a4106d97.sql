
-- Ajouter la colonne event_type à la table events
ALTER TABLE public.events 
ADD COLUMN event_type text 
CHECK (event_type IN ('salon','convention','congres','conference','ceremonie','loisir','inconnu')) 
DEFAULT NULL;
