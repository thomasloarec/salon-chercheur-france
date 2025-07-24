-- ============================================================================
-- SCRIPT SQL : Correction schéma event_sectors + optimisations
-- Compatible Supabase/Postgres 15
-- 
-- OBJECTIFS :
-- 1. Ajouter les foreign keys manquantes sur event_sectors
-- 2. Vérifier/corriger les types de colonnes date
-- 3. Créer un index composite pour les jointures
-- 4. Nettoyer les anciennes contraintes
--
-- USAGE dans Supabase Studio :
-- 1. Aller sur https://supabase.com/dashboard/project/vxivdvzzhebobveedxbj/sql/new
-- 2. Coller ce script complet
-- 3. Cliquer "Run" pour exécuter
-- ============================================================================

-- SECTION 1: Nettoyage des anciennes contraintes (éviter les collisions)
-- -----------------------------------------------------------------------
DO $$ 
BEGIN
    -- Supprimer l'ancienne FK event_sectors.event_id → events.id si elle existe
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'event_sectors_event_id_fkey' 
        AND table_name = 'event_sectors'
    ) THEN
        ALTER TABLE public.event_sectors DROP CONSTRAINT event_sectors_event_id_fkey;
        RAISE NOTICE 'Ancienne contrainte event_sectors_event_id_fkey supprimée';
    END IF;

    -- Supprimer l'ancienne FK event_sectors.sector_id → sectors.id si elle existe
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'event_sectors_sector_id_fkey' 
        AND table_name = 'event_sectors'
    ) THEN
        ALTER TABLE public.event_sectors DROP CONSTRAINT event_sectors_sector_id_fkey;
        RAISE NOTICE 'Ancienne contrainte event_sectors_sector_id_fkey supprimée';
    END IF;

    -- Supprimer l'ancien index composite s'il existe
    IF EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'event_sectors_event_id_sector_id_idx'
    ) THEN
        DROP INDEX public.event_sectors_event_id_sector_id_idx;
        RAISE NOTICE 'Ancien index event_sectors_event_id_sector_id_idx supprimé';
    END IF;
END $$;

-- SECTION 2: Vérification et correction des types de colonnes
-- ----------------------------------------------------------

-- 2.1. Vérifier que events.date_debut et events.date_fin sont bien de type DATE
DO $$
DECLARE
    debut_type text;
    fin_type text;
BEGIN
    -- Récupérer les types actuels
    SELECT data_type INTO debut_type 
    FROM information_schema.columns 
    WHERE table_name = 'events' AND column_name = 'date_debut';
    
    SELECT data_type INTO fin_type 
    FROM information_schema.columns 
    WHERE table_name = 'events' AND column_name = 'date_fin';
    
    RAISE NOTICE 'Type actuel date_debut: %, date_fin: %', debut_type, fin_type;
    
    -- Convertir en DATE si nécessaire
    IF debut_type != 'date' THEN
        ALTER TABLE public.events ALTER COLUMN date_debut TYPE DATE USING date_debut::DATE;
        RAISE NOTICE 'Colonne date_debut convertie en DATE';
    END IF;
    
    IF fin_type != 'date' THEN
        ALTER TABLE public.events ALTER COLUMN date_fin TYPE DATE USING date_fin::DATE;
        RAISE NOTICE 'Colonne date_fin convertie en DATE';
    END IF;
END $$;

-- 2.2. Vérifier que event_sectors utilise des UUIDs (cohérent avec events.id et sectors.id)
DO $$
DECLARE
    event_id_type text;
    sector_id_type text;
    events_id_type text;
    sectors_id_type text;
BEGIN
    -- Récupérer les types actuels
    SELECT data_type INTO event_id_type 
    FROM information_schema.columns 
    WHERE table_name = 'event_sectors' AND column_name = 'event_id';
    
    SELECT data_type INTO sector_id_type 
    FROM information_schema.columns 
    WHERE table_name = 'event_sectors' AND column_name = 'sector_id';
    
    SELECT data_type INTO events_id_type 
    FROM information_schema.columns 
    WHERE table_name = 'events' AND column_name = 'id';
    
    SELECT data_type INTO sectors_id_type 
    FROM information_schema.columns 
    WHERE table_name = 'sectors' AND column_name = 'id';
    
    RAISE NOTICE 'Types: event_sectors.event_id=%, event_sectors.sector_id=%, events.id=%, sectors.id=%', 
                 event_id_type, sector_id_type, events_id_type, sectors_id_type;
    
    -- Convertir event_id en UUID si nécessaire
    IF event_id_type != 'uuid' AND events_id_type = 'uuid' THEN
        ALTER TABLE public.event_sectors ALTER COLUMN event_id TYPE UUID USING event_id::UUID;
        RAISE NOTICE 'Colonne event_id convertie en UUID';
    END IF;
    
    -- Convertir sector_id en UUID si nécessaire  
    IF sector_id_type != 'uuid' AND sectors_id_type = 'uuid' THEN
        ALTER TABLE public.event_sectors ALTER COLUMN sector_id TYPE UUID USING sector_id::UUID;
        RAISE NOTICE 'Colonne sector_id convertie en UUID';
    END IF;
END $$;

-- SECTION 3: Nettoyage des données orphelines (optionnel mais recommandé)
-- -----------------------------------------------------------------------

-- 3.1. Supprimer les event_sectors qui pointent vers des events inexistants
DELETE FROM public.event_sectors 
WHERE event_id NOT IN (SELECT id FROM public.events);

-- 3.2. Supprimer les event_sectors qui pointent vers des sectors inexistants  
DELETE FROM public.event_sectors 
WHERE sector_id NOT IN (SELECT id FROM public.sectors);

-- SECTION 4: Création des contraintes de foreign key
-- --------------------------------------------------

-- 4.1. Foreign key: event_sectors.event_id → events.id
ALTER TABLE public.event_sectors
ADD CONSTRAINT event_sectors_event_id_fkey 
FOREIGN KEY (event_id) 
REFERENCES public.events(id) 
ON UPDATE CASCADE 
ON DELETE CASCADE;

-- 4.2. Foreign key: event_sectors.sector_id → sectors.id
ALTER TABLE public.event_sectors
ADD CONSTRAINT event_sectors_sector_id_fkey 
FOREIGN KEY (sector_id) 
REFERENCES public.sectors(id) 
ON UPDATE CASCADE 
ON DELETE CASCADE;

-- SECTION 5: Création de l'index composite pour optimiser les jointures
-- ---------------------------------------------------------------------

-- Index composite sur (event_id, sector_id) pour optimiser :
-- - Les requêtes GET /events?select=*,event_sectors(sectors(*))
-- - Les recherches par event_id
-- - Les recherches par (event_id, sector_id) pour éviter les doublons
CREATE INDEX event_sectors_event_id_sector_id_idx 
ON public.event_sectors (event_id, sector_id);

-- Index supplémentaire sur sector_id seul pour les requêtes inverses
CREATE INDEX IF NOT EXISTS event_sectors_sector_id_idx 
ON public.event_sectors (sector_id);

-- SECTION 6: Contrainte d'unicité (éviter les doublons)
-- -----------------------------------------------------

-- Ajouter une contrainte unique sur (event_id, sector_id) si elle n'existe pas
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'event_sectors_unique_pair' 
        AND table_name = 'event_sectors'
    ) THEN
        ALTER TABLE public.event_sectors
        ADD CONSTRAINT event_sectors_unique_pair 
        UNIQUE (event_id, sector_id);
        RAISE NOTICE 'Contrainte unique event_sectors_unique_pair ajoutée';
    END IF;
END $$;

-- SECTION 7: Vérifications finales
-- --------------------------------

-- Afficher un résumé des contraintes créées
SELECT 
    tc.constraint_name,
    tc.constraint_type,
    tc.table_name,
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

-- Afficher les index créés
SELECT 
    indexname,
    tablename,
    indexdef
FROM pg_indexes 
WHERE tablename = 'event_sectors'
ORDER BY indexname;

-- ============================================================================
-- FIN DU SCRIPT
-- 
-- VÉRIFICATION POST-EXÉCUTION :
-- 1. Tester une requête avec jointure :
--    GET /rest/v1/events?select=*,event_sectors(sectors(id,name))
-- 2. Vérifier que l'import Airtable fonctionne toujours
-- 3. Monitorer les performances avec les nouveaux index
-- ============================================================================