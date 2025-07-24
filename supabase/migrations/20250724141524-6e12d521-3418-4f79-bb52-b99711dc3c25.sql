-- ============================================================================
-- SCRIPT SQL : Correction schéma event_sectors + optimisations  
-- Compatible Supabase/Postgres 15
-- 
-- PROBLÈME IDENTIFIÉ : 
-- - events utilise id_event (TEXT) comme PK, pas id (UUID)
-- - event_sectors.event_id est UUID mais doit pointer vers events
-- - Il faut d'abord ajouter une colonne UUID à events ou corriger la référence
-- ============================================================================

-- SECTION 1: Analyse du problème de clé primaire
-- ----------------------------------------------

-- Vérifier si events a une vraie clé primaire UUID
DO $$
DECLARE
    pk_column text;
    pk_type text;
BEGIN
    -- Chercher la clé primaire de events
    SELECT kcu.column_name, c.data_type 
    INTO pk_column, pk_type
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.columns c 
        ON kcu.table_name = c.table_name AND kcu.column_name = c.column_name
    WHERE tc.table_name = 'events' 
        AND tc.constraint_type = 'PRIMARY KEY';
    
    IF pk_column IS NULL THEN
        RAISE NOTICE 'ATTENTION: Table events n''a pas de clé primaire définie!';
        RAISE NOTICE 'Colonnes disponibles: id_event (text), créer une PK UUID est nécessaire';
    ELSE
        RAISE NOTICE 'PK events: % (type: %)', pk_column, pk_type;
    END IF;
END $$;

-- SECTION 2: Ajouter une colonne UUID comme vraie PK à events
-- -----------------------------------------------------------

-- Ajouter une colonne id UUID si elle n'existe pas
ALTER TABLE public.events 
ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();

-- Faire de cette colonne la clé primaire si events n'en a pas
DO $$
BEGIN
    -- Vérifier s'il y a déjà une PK
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'events' AND constraint_type = 'PRIMARY KEY'
    ) THEN
        -- Remplir les UUID manquants
        UPDATE public.events SET id = gen_random_uuid() WHERE id IS NULL;
        
        -- Rendre la colonne NOT NULL
        ALTER TABLE public.events ALTER COLUMN id SET NOT NULL;
        
        -- Ajouter la contrainte PK
        ALTER TABLE public.events ADD CONSTRAINT events_pkey PRIMARY KEY (id);
        
        RAISE NOTICE 'Clé primaire UUID ajoutée à events';
    ELSE
        RAISE NOTICE 'Table events a déjà une clé primaire';
    END IF;
END $$;

-- SECTION 3: Nettoyage des contraintes event_sectors existantes
-- -------------------------------------------------------------
DO $$ 
BEGIN
    -- Supprimer les anciennes FK si elles existent
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'event_sectors_event_id_fkey' 
        AND table_name = 'event_sectors'
    ) THEN
        ALTER TABLE public.event_sectors DROP CONSTRAINT event_sectors_event_id_fkey;
        RAISE NOTICE 'Ancienne contrainte event_sectors_event_id_fkey supprimée';
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'event_sectors_sector_id_fkey' 
        AND table_name = 'event_sectors'
    ) THEN
        ALTER TABLE public.event_sectors DROP CONSTRAINT event_sectors_sector_id_fkey;
        RAISE NOTICE 'Ancienne contrainte event_sectors_sector_id_fkey supprimée';
    END IF;

    -- Supprimer les anciens index
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'event_sectors_event_id_sector_id_idx') THEN
        DROP INDEX public.event_sectors_event_id_sector_id_idx;
        RAISE NOTICE 'Ancien index event_sectors_event_id_sector_id_idx supprimé';
    END IF;
END $$;

-- SECTION 4: Nettoyage des données orphelines dans event_sectors
-- --------------------------------------------------------------

-- Nettoyer les event_sectors qui ne correspondent à aucun event
-- (en utilisant la nouvelle colonne id UUID)
DELETE FROM public.event_sectors 
WHERE event_id NOT IN (SELECT id FROM public.events WHERE id IS NOT NULL);

-- Nettoyer les event_sectors qui pointent vers des sectors inexistants
DELETE FROM public.event_sectors 
WHERE sector_id NOT IN (SELECT id FROM public.sectors);

-- SECTION 5: Création des contraintes FK correctes
-- ------------------------------------------------

-- FK: event_sectors.event_id → events.id (UUID)
ALTER TABLE public.event_sectors
ADD CONSTRAINT event_sectors_event_id_fkey 
FOREIGN KEY (event_id) 
REFERENCES public.events(id) 
ON UPDATE CASCADE 
ON DELETE CASCADE;

-- FK: event_sectors.sector_id → sectors.id (UUID)  
ALTER TABLE public.event_sectors
ADD CONSTRAINT event_sectors_sector_id_fkey 
FOREIGN KEY (sector_id) 
REFERENCES public.sectors(id) 
ON UPDATE CASCADE 
ON DELETE CASCADE;

-- SECTION 6: Index optimisés pour les jointures
-- ---------------------------------------------

-- Index composite principal (event_id, sector_id)
CREATE INDEX event_sectors_event_id_sector_id_idx 
ON public.event_sectors (event_id, sector_id);

-- Index sur sector_id seul pour les requêtes inverses
CREATE INDEX IF NOT EXISTS event_sectors_sector_id_idx 
ON public.event_sectors (sector_id);

-- SECTION 7: Contrainte d'unicité
-- -------------------------------

-- Éviter les doublons (event_id, sector_id)
ALTER TABLE public.event_sectors
ADD CONSTRAINT IF NOT EXISTS event_sectors_unique_pair 
UNIQUE (event_id, sector_id);

-- SECTION 8: Mise à jour du trigger de synchronisation des secteurs
-- -----------------------------------------------------------------

-- Le trigger sync_event_sectors doit être adapté pour utiliser events.id au lieu de secteur JSON
-- Voici une version mise à jour:

CREATE OR REPLACE FUNCTION public.sync_event_sectors()
RETURNS trigger AS $$
DECLARE
  v_sector record;
BEGIN
  -- Supprimer les anciens liens
  DELETE FROM public.event_sectors WHERE event_id = NEW.id;

  -- Recréer les liens basés sur secteur JSON
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

-- Recréer le trigger sur events
DROP TRIGGER IF EXISTS sync_event_sectors_trigger ON public.events;
CREATE TRIGGER sync_event_sectors_trigger
  AFTER INSERT OR UPDATE OF secteur ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_event_sectors();

-- SECTION 9: Vérifications finales
-- --------------------------------

-- Vérifier les contraintes créées
SELECT 
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
LEFT JOIN information_schema.constraint_column_usage ccu 
    ON tc.constraint_name = ccu.constraint_name
WHERE tc.table_name = 'event_sectors'
    AND tc.constraint_type IN ('FOREIGN KEY', 'UNIQUE')
ORDER BY tc.constraint_type, tc.constraint_name;

-- Vérifier les index créés
SELECT indexname, tablename, indexdef
FROM pg_indexes 
WHERE tablename = 'event_sectors'
ORDER BY indexname;

-- Compter les event_sectors valides
SELECT 
    COUNT(*) as total_event_sectors,
    COUNT(DISTINCT event_id) as unique_events,
    COUNT(DISTINCT sector_id) as unique_sectors
FROM public.event_sectors;

-- ============================================================================
-- RÉSUMÉ DES CHANGEMENTS :
-- 
-- ✅ Ajout colonne events.id UUID comme vraie PK
-- ✅ Foreign keys event_sectors → events.id et sectors.id  
-- ✅ Index optimisés pour jointures
-- ✅ Contrainte unique anti-doublons
-- ✅ Trigger sync_event_sectors adapté
-- 
-- TEST À FAIRE :
-- GET /rest/v1/events?select=*,event_sectors(sectors(id,name))
-- ============================================================================