-- Améliorer la table participation pour supporter les nouveaux exposants créés via le flux de nouveautés
-- Actuellement id_exposant est de type text, ce qui pose problème avec les exhibitors.id qui sont des UUID

-- Ajouter une colonne temporaire pour la migration
ALTER TABLE participation ADD COLUMN IF NOT EXISTS exhibitor_id uuid;

-- Créer un index pour les performances
CREATE INDEX IF NOT EXISTS idx_participation_exhibitor_id ON participation(exhibitor_id);

-- Créer une fonction pour récupérer l'UUID de l'exhibitor depuis le nom ou l'id_exposant
CREATE OR REPLACE FUNCTION get_exhibitor_uuid(old_id text) RETURNS uuid AS $$
DECLARE
  found_uuid uuid;
BEGIN
  -- Essayer de trouver par correspondance de nom dans exhibitors
  SELECT e.id INTO found_uuid
  FROM exhibitors e
  JOIN exposants ex ON LOWER(TRIM(e.name)) = LOWER(TRIM(ex.nom_exposant))
  WHERE ex.id_exposant = old_id
  LIMIT 1;
  
  RETURN found_uuid;
END;
$$ LANGUAGE plpgsql;

-- Commenter la migration pour information
COMMENT ON COLUMN participation.exhibitor_id IS 'UUID de l''exposant dans la table exhibitors (nouveau système)';
COMMENT ON COLUMN participation.id_exposant IS 'Ancien identifiant texte de l''exposant (legacy, à migrer vers exhibitor_id)';