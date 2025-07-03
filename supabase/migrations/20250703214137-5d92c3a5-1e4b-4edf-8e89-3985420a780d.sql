-- 1. Ajouter la colonne id_event (type TEXT)
ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS id_event TEXT;

-- 2. Créer un index unique sur id_event pour gérer l'onConflict
CREATE UNIQUE INDEX IF NOT EXISTS events_id_event_idx
ON public.events (id_event);