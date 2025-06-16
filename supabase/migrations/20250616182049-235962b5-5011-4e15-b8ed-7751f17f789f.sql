
-- 1. Créer l'enum pour les types d'événements si il n'existe pas
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'event_type_enum') THEN
    CREATE TYPE event_type_enum AS ENUM ('salon', 'convention', 'congres', 'conference', 'ceremonie');
  END IF;
END$$;

-- 2. Ajouter la colonne event_type si elle n'existe pas déjà
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'events' AND column_name = 'event_type') THEN
    ALTER TABLE events ADD COLUMN event_type event_type_enum;
  END IF;
END$$;

-- 3. Mettre à jour les événements existants en fonction de leur ancien champ event_type (s'il existe)
-- et utiliser 'salon' comme valeur par défaut
UPDATE events 
SET event_type = CASE 
  WHEN event_type IS NULL OR event_type = '' THEN 'salon'::event_type_enum
  ELSE event_type::event_type_enum
END
WHERE event_type IS NULL;

-- 4. Rendre la colonne NOT NULL maintenant qu'elle a des valeurs
ALTER TABLE events ALTER COLUMN event_type SET NOT NULL;

-- 5. Définir la valeur par défaut pour les nouveaux enregistrements
ALTER TABLE events ALTER COLUMN event_type SET DEFAULT 'salon'::event_type_enum;

-- 6. Créer un index pour optimiser les filtres par type
CREATE INDEX IF NOT EXISTS events_event_type_idx ON events(event_type);
