-- 2025-07-23 : suppression de la colonne id_event de la table exposants
BEGIN;

-- 1. Si une contrainte FK existait, la supprimer :
ALTER TABLE exposants
  DROP CONSTRAINT IF EXISTS exposants_id_event_fkey;

-- 2. Supprimer la colonne id_event
ALTER TABLE exposants
  DROP COLUMN IF EXISTS id_event;

COMMIT;