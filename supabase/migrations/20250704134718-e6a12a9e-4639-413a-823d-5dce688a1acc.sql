-- Ajouter les colonnes manquantes à events_import
ALTER TABLE public.events_import
ADD COLUMN IF NOT EXISTS rue TEXT,
ADD COLUMN IF NOT EXISTS postal_code TEXT,
ADD COLUMN IF NOT EXISTS ville TEXT;