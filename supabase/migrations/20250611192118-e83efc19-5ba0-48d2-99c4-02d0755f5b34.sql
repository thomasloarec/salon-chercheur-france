
-- Ajouter la colonne website_url si elle n'existe pas déjà
ALTER TABLE public.events 
ADD COLUMN IF NOT EXISTS website_url TEXT;

-- Créer l'index unique sur website_url pour permettre l'upsert
CREATE UNIQUE INDEX IF NOT EXISTS events_website_url_key 
ON public.events(website_url);

-- Invalider le cache PostgREST pour forcer la mise à jour du schéma
NOTIFY pgrst, 'reload schema';
