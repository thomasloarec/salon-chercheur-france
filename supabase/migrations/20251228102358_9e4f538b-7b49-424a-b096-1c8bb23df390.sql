-- Ajouter une colonne pour tracker les exposants créés en attente de validation
-- Quand une nouveauté est créée avec un nouvel exposant, on stocke l'ID ici
-- L'exposant ne sera approuvé que lorsque la nouveauté sera publiée

ALTER TABLE public.novelties 
ADD COLUMN IF NOT EXISTS pending_exhibitor_id uuid REFERENCES public.exhibitors(id);

-- Index pour les recherches
CREATE INDEX IF NOT EXISTS idx_novelties_pending_exhibitor 
ON public.novelties(pending_exhibitor_id) 
WHERE pending_exhibitor_id IS NOT NULL;

-- Commentaire explicatif
COMMENT ON COLUMN public.novelties.pending_exhibitor_id IS 
'UUID de l''exposant créé avec cette nouveauté, en attente d''approbation. Quand la nouveauté est publiée, l''exposant est approuvé.';