-- Étape 1: Supprimer l'ancienne contrainte de clé étrangère
ALTER TABLE public.favorites DROP CONSTRAINT IF EXISTS favorites_event_id_fkey;

-- Étape 2: Créer la nouvelle contrainte de clé étrangère vers events.id (UUID)
ALTER TABLE public.favorites 
ADD CONSTRAINT favorites_event_id_fkey 
FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;

-- Étape 3: Ajouter un index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_favorites_event_id ON public.favorites(event_id);

-- Étape 4: Nettoyer les données orphelines (optionnel, si il y en a)
-- DELETE FROM public.favorites WHERE event_id NOT IN (SELECT id FROM public.events);

-- Note: La table events_old peut être supprimée plus tard quand on sera sûr qu'elle n'est plus utilisée