-- ============================================================================
-- SCRIPT SQL : Correction schéma event_sectors + optimisations (VERSION CORRIGÉE)
-- Compatible Supabase/Postgres 15
-- ============================================================================

-- SECTION 1: Ajouter colonne UUID à events si nécessaire
-- ------------------------------------------------------
ALTER TABLE public.events 
ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();

-- Remplir les UUID manquants et définir comme PK
DO $$
BEGIN
    -- Remplir les UUID manquants
    UPDATE public.events SET id = gen_random_uuid() WHERE id IS NULL;
    
    -- Rendre NOT NULL
    ALTER TABLE public.events ALTER COLUMN id SET NOT NULL;
    
    -- Ajouter PK si elle n'existe pas
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'events' AND constraint_type = 'PRIMARY KEY'
    ) THEN
        ALTER TABLE public.events ADD CONSTRAINT events_pkey PRIMARY KEY (id);
        RAISE NOTICE 'Clé primaire UUID ajoutée à events';
    END IF;
END $$;

-- SECTION 2: Nettoyer les contraintes existantes
-- ----------------------------------------------
DO $$ 
BEGIN
    -- Supprimer FK existantes
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'event_sectors_event_id_fkey'
    ) THEN
        ALTER TABLE public.event_sectors DROP CONSTRAINT event_sectors_event_id_fkey;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'event_sectors_sector_id_fkey'
    ) THEN
        ALTER TABLE public.event_sectors DROP CONSTRAINT event_sectors_sector_id_fkey;
    END IF;

    -- Supprimer contrainte unique existante
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'event_sectors_unique_pair'
    ) THEN
        ALTER TABLE public.event_sectors DROP CONSTRAINT event_sectors_unique_pair;
    END IF;
END $$;

-- SECTION 3: Nettoyer données orphelines
-- --------------------------------------
DELETE FROM public.event_sectors 
WHERE event_id NOT IN (SELECT id FROM public.events WHERE id IS NOT NULL);

DELETE FROM public.event_sectors 
WHERE sector_id NOT IN (SELECT id FROM public.sectors);

-- SECTION 4: Créer les contraintes FK
-- -----------------------------------
ALTER TABLE public.event_sectors
ADD CONSTRAINT event_sectors_event_id_fkey 
FOREIGN KEY (event_id) 
REFERENCES public.events(id) 
ON UPDATE CASCADE 
ON DELETE CASCADE;

ALTER TABLE public.event_sectors
ADD CONSTRAINT event_sectors_sector_id_fkey 
FOREIGN KEY (sector_id) 
REFERENCES public.sectors(id) 
ON UPDATE CASCADE 
ON DELETE CASCADE;

-- SECTION 5: Contrainte unique
-- ----------------------------
ALTER TABLE public.event_sectors
ADD CONSTRAINT event_sectors_unique_pair 
UNIQUE (event_id, sector_id);

-- SECTION 6: Index optimisés
-- --------------------------
DROP INDEX IF EXISTS event_sectors_event_id_sector_id_idx;
CREATE INDEX event_sectors_event_id_sector_id_idx 
ON public.event_sectors (event_id, sector_id);

CREATE INDEX IF NOT EXISTS event_sectors_sector_id_idx 
ON public.event_sectors (sector_id);

-- SECTION 7: Trigger mis à jour
-- -----------------------------
CREATE OR REPLACE FUNCTION public.sync_event_sectors()
RETURNS trigger AS $$
DECLARE
  v_sector record;
BEGIN
  DELETE FROM public.event_sectors WHERE event_id = NEW.id;

  IF NEW.secteur IS NOT NULL THEN
    FOR v_sector IN
      SELECT s.id
      FROM public.sectors s
      WHERE NEW.secteur @> to_jsonb(s.name)
    LOOP
      INSERT INTO public.event_sectors(event_id, sector_id)
      VALUES (NEW.id, v_sector.id)
      ON CONFLICT (event_id, sector_id) DO NOTHING;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sync_event_sectors_trigger ON public.events;
CREATE TRIGGER sync_event_sectors_trigger
  AFTER INSERT OR UPDATE OF secteur ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_event_sectors();

-- SECTION 8: Vérifications
-- ------------------------
SELECT 'Foreign Keys créées:' as status;
SELECT constraint_name, constraint_type 
FROM information_schema.table_constraints 
WHERE table_name = 'event_sectors' 
AND constraint_type = 'FOREIGN KEY';

SELECT 'Index créés:' as status;
SELECT indexname FROM pg_indexes WHERE tablename = 'event_sectors';