-- Ajouter les colonnes manquantes à participation_import_errors
ALTER TABLE participation_import_errors 
ADD COLUMN id_event UUID,
ADD COLUMN stand_exposant text,
ADD COLUMN nom_exposant text;