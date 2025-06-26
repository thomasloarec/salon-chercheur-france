
-- Ajouter les départements ultramarins manquants
INSERT INTO public.departements (code, nom, region_code) VALUES
('975', 'Saint-Pierre-et-Miquelon', '01')
ON CONFLICT (code) DO NOTHING;

-- Corriger les codes région pour les DOM-TOM existants
UPDATE public.departements 
SET region_code = '02' 
WHERE code = '972' AND region_code = '01';

UPDATE public.departements 
SET region_code = '03' 
WHERE code = '973' AND region_code = '01';

UPDATE public.departements 
SET region_code = '04' 
WHERE code = '974' AND region_code = '01';

UPDATE public.departements 
SET region_code = '06' 
WHERE code = '976' AND region_code = '01';
