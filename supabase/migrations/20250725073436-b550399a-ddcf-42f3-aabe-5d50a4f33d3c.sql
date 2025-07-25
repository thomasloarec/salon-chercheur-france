-- Vérifier et corriger le schéma de la table events_import
-- Ajouter les colonnes manquantes si elles n'existent pas

-- Ajouter la colonne id si elle n'existe pas
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'events_import' AND column_name = 'id') THEN
        ALTER TABLE public.events_import ADD COLUMN id UUID DEFAULT gen_random_uuid();
    END IF;
END $$;

-- Ajouter la colonne created_at si elle n'existe pas
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'events_import' AND column_name = 'created_at') THEN
        ALTER TABLE public.events_import ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT now();
    END IF;
END $$;

-- Mettre à jour les enregistrements existants pour qu'ils aient un ID si nécessaire
UPDATE public.events_import SET id = gen_random_uuid() WHERE id IS NULL;

-- Mettre à jour les enregistrements existants pour qu'ils aient une date de création si nécessaire
UPDATE public.events_import SET created_at = now() WHERE created_at IS NULL;