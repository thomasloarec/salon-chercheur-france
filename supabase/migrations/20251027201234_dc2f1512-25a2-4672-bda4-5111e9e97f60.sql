-- Réparer les participations qui utilisent des websites comme id_exposant
-- Étape 1 : Matcher par website direct
UPDATE participation p
SET exhibitor_id = ex.id
FROM exhibitors ex
WHERE p.exhibitor_id IS NULL
  AND p.id_exposant IS NOT NULL
  AND ex.website IS NOT NULL
  AND (
    LOWER(TRIM(ex.website)) = LOWER(TRIM(p.id_exposant))
    OR LOWER(TRIM(ex.website)) LIKE '%' || LOWER(TRIM(p.id_exposant)) || '%'
    OR LOWER(TRIM(p.id_exposant)) LIKE '%' || LOWER(TRIM(ex.website)) || '%'
  );

-- Étape 2 : Pour les participations encore orphelines, créer des exhibitors basiques
DO $$
DECLARE
  participation_record RECORD;
  new_exhibitor_id UUID;
  exhibitor_name TEXT;
BEGIN
  FOR participation_record IN 
    SELECT DISTINCT 
      p.id_exposant,
      p.website_exposant,
      ev.nom_event
    FROM participation p
    LEFT JOIN events ev ON ev.id = p.id_event
    WHERE p.exhibitor_id IS NULL
      AND p.id_exposant IS NOT NULL
      AND p.id_exposant NOT LIKE 'EXP-%'
      AND NOT EXISTS (
        SELECT 1 FROM exhibitors ex 
        WHERE LOWER(TRIM(ex.website)) = LOWER(TRIM(p.id_exposant))
      )
    LIMIT 50  -- Limiter pour éviter timeout
  LOOP
    -- Générer un nom basé sur le website
    exhibitor_name := REGEXP_REPLACE(participation_record.id_exposant, '\.(com|fr|net|org|it|uk|ch|pl)$', '', 'i');
    exhibitor_name := REGEXP_REPLACE(exhibitor_name, '[^a-zA-Z0-9]', ' ', 'g');
    exhibitor_name := INITCAP(TRIM(exhibitor_name));
    
    -- Créer l'exhibitor
    INSERT INTO exhibitors (name, website, approved, plan)
    VALUES (
      exhibitor_name,
      participation_record.id_exposant,
      true,
      'free'
    )
    RETURNING id INTO new_exhibitor_id;
    
    -- Lier les participations
    UPDATE participation
    SET exhibitor_id = new_exhibitor_id
    WHERE id_exposant = participation_record.id_exposant
      AND exhibitor_id IS NULL;
      
    RAISE NOTICE 'Créé exhibitor % pour website %', exhibitor_name, participation_record.id_exposant;
  END LOOP;
END $$;