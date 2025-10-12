-- Étape 1 : Supprimer la contrainte CHECK actuelle
ALTER TABLE novelties DROP CONSTRAINT IF EXISTS novelties_status_check;

-- Étape 2 : Normaliser tous les status en minuscules
UPDATE novelties
SET status = LOWER(TRIM(status))
WHERE status IS NOT NULL;

-- Étape 3 : Recréer la contrainte avec les valeurs en minuscules
ALTER TABLE novelties 
ADD CONSTRAINT novelties_status_check 
CHECK (status IN ('published', 'pending', 'rejected', 'draft', 'under_review'));

-- Étape 4 : Créer un index pour optimiser les requêtes
CREATE INDEX IF NOT EXISTS idx_novelties_event_status_created 
ON novelties (event_id, status, created_at DESC);