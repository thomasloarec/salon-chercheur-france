
-- Ajouter tous les départements ultramarins manquants
INSERT INTO public.departements (code, nom, region_code) VALUES
('971','Guadeloupe','01'),
('972','Martinique','01'),
('973','Guyane','01'),
('974','La Réunion','01'),
('975','Saint-Pierre-et-Miquelon','01'),
('976','Mayotte','01'),
('977','Saint-Barthélemy','01'),
('978','Saint-Martin','01')
ON CONFLICT (code) DO NOTHING;
