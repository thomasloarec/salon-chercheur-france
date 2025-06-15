
-- Supprimer tous les secteurs existants et les remplacer par la nouvelle liste
DELETE FROM public.sectors;

-- Insérer les nouveaux secteurs avec des IDs fixes pour faciliter les migrations
INSERT INTO public.sectors (id, name, created_at) VALUES
('550e8400-e29b-41d4-a716-446655440001'::uuid, 'Agroalimentaire & Boissons', now()),
('550e8400-e29b-41d4-a716-446655440002'::uuid, 'Automobile & Mobilité', now()),
('550e8400-e29b-41d4-a716-446655440003'::uuid, 'BTP & Construction', now()),
('550e8400-e29b-41d4-a716-446655440004'::uuid, 'Cosmétique & Bien-être', now()),
('550e8400-e29b-41d4-a716-446655440005'::uuid, 'Énergie & Environnement', now()),
('550e8400-e29b-41d4-a716-446655440006'::uuid, 'Industrie & Production', now()),
('550e8400-e29b-41d4-a716-446655440007'::uuid, 'Santé & Médical', now()),
('550e8400-e29b-41d4-a716-446655440008'::uuid, 'Technologie & Innovation', now()),
('550e8400-e29b-41d4-a716-446655440009'::uuid, 'Mode & Textile', now()),
('550e8400-e29b-41d4-a716-446655440010'::uuid, 'Commerce & Distribution', now()),
('550e8400-e29b-41d4-a716-446655440011'::uuid, 'Éducation & Formation', now()),
('550e8400-e29b-41d4-a716-446655440012'::uuid, 'Tourisme & Événementiel', now());

-- Nettoyer toutes les relations event_sectors existantes car les IDs des secteurs ont changé
DELETE FROM public.event_sectors;

-- Mettre à jour les événements existants pour les associer aux nouveaux secteurs
-- basé sur leur ancien champ 'sector' (mapping approximatif)
INSERT INTO public.event_sectors (event_id, sector_id)
SELECT 
  e.id,
  CASE 
    WHEN LOWER(e.sector) LIKE '%technolog%' OR LOWER(e.sector) LIKE '%informatique%' OR LOWER(e.sector) LIKE '%digital%' OR LOWER(e.sector) LIKE '%ia%' OR LOWER(e.sector) LIKE '%robot%' THEN '550e8400-e29b-41d4-a716-446655440008'::uuid
    WHEN LOWER(e.sector) LIKE '%industrie%' OR LOWER(e.sector) LIKE '%mecanique%' OR LOWER(e.sector) LIKE '%production%' OR LOWER(e.sector) LIKE '%manufacture%' THEN '550e8400-e29b-41d4-a716-446655440006'::uuid
    WHEN LOWER(e.sector) LIKE '%sante%' OR LOWER(e.sector) LIKE '%medical%' OR LOWER(e.sector) LIKE '%pharmaceutique%' OR LOWER(e.sector) LIKE '%biotech%' THEN '550e8400-e29b-41d4-a716-446655440007'::uuid
    WHEN LOWER(e.sector) LIKE '%btp%' OR LOWER(e.sector) LIKE '%batiment%' OR LOWER(e.sector) LIKE '%construction%' OR LOWER(e.sector) LIKE '%immobilier%' THEN '550e8400-e29b-41d4-a716-446655440003'::uuid
    WHEN LOWER(e.sector) LIKE '%commerce%' OR LOWER(e.sector) LIKE '%retail%' OR LOWER(e.sector) LIKE '%distribution%' OR LOWER(e.sector) LIKE '%vente%' THEN '550e8400-e29b-41d4-a716-446655440010'::uuid
    WHEN LOWER(e.sector) LIKE '%agroalimentaire%' OR LOWER(e.sector) LIKE '%alimentation%' OR LOWER(e.sector) LIKE '%agriculture%' OR LOWER(e.sector) LIKE '%boisson%' THEN '550e8400-e29b-41d4-a716-446655440001'::uuid
    WHEN LOWER(e.sector) LIKE '%energie%' OR LOWER(e.sector) LIKE '%environnement%' OR LOWER(e.sector) LIKE '%renouvelable%' OR LOWER(e.sector) LIKE '%durable%' THEN '550e8400-e29b-41d4-a716-446655440005'::uuid
    WHEN LOWER(e.sector) LIKE '%automobile%' OR LOWER(e.sector) LIKE '%mobilite%' OR LOWER(e.sector) LIKE '%transport%' THEN '550e8400-e29b-41d4-a716-446655440002'::uuid
    WHEN LOWER(e.sector) LIKE '%cosmetique%' OR LOWER(e.sector) LIKE '%beaute%' OR LOWER(e.sector) LIKE '%bien-etre%' OR LOWER(e.sector) LIKE '%esthetique%' THEN '550e8400-e29b-41d4-a716-446655440004'::uuid
    WHEN LOWER(e.sector) LIKE '%mode%' OR LOWER(e.sector) LIKE '%textile%' OR LOWER(e.sector) LIKE '%vetement%' OR LOWER(e.sector) LIKE '%fashion%' THEN '550e8400-e29b-41d4-a716-446655440009'::uuid
    WHEN LOWER(e.sector) LIKE '%education%' OR LOWER(e.sector) LIKE '%formation%' OR LOWER(e.sector) LIKE '%enseignement%' OR LOWER(e.sector) LIKE '%ecole%' THEN '550e8400-e29b-41d4-a716-446655440011'::uuid
    WHEN LOWER(e.sector) LIKE '%tourisme%' OR LOWER(e.sector) LIKE '%evenementiel%' OR LOWER(e.sector) LIKE '%loisir%' OR LOWER(e.sector) LIKE '%voyage%' THEN '550e8400-e29b-41d4-a716-446655440012'::uuid
    ELSE '550e8400-e29b-41d4-a716-446655440006'::uuid -- Par défaut: Industrie & Production
  END as sector_id
FROM events e
WHERE e.id IS NOT NULL;
