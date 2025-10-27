-- Version simplifiée : créer les exhibitors et liens sans modifier exposants
-- Étape 1 : Créer les exhibitors pour les exposants qui n'en ont pas
DO $$
DECLARE
  exposant_record RECORD;
  new_exhibitor_id UUID;
BEGIN
  FOR exposant_record IN 
    SELECT DISTINCT e.nom_exposant, e.website_exposant, e.exposant_description, e.id_exposant
    FROM exposants e
    WHERE NOT EXISTS (
      SELECT 1 FROM exhibitors ex WHERE ex.name = e.nom_exposant
    )
    AND e.nom_exposant IS NOT NULL
    AND e.nom_exposant != ''
  LOOP
    -- Créer l'exhibitor
    INSERT INTO exhibitors (name, website, description, approved, plan)
    VALUES (
      exposant_record.nom_exposant,
      exposant_record.website_exposant,
      exposant_record.exposant_description,
      true,
      'free'
    )
    RETURNING id INTO new_exhibitor_id;
    
    -- Mettre à jour toutes les participations correspondantes
    UPDATE participation
    SET exhibitor_id = new_exhibitor_id
    WHERE id_exposant = exposant_record.id_exposant
      AND exhibitor_id IS NULL;
  END LOOP;
END $$;