
-- 3.1 Suggestions pour "ile de france"
SELECT * FROM public.get_location_suggestions('ile de france');

-- 3.2 Nom normalisé de la région 11
SELECT lower(unaccent(regexp_replace(nom, '[\s\-]', '', 'g')))
FROM regions
WHERE code = '11';

-- 4.a Premier événement contenant "villepinte" dans l'adresse
SELECT id, city, postal_code, address
FROM events
WHERE address ILIKE '%villepinte%'
LIMIT 1;

-- 4.c Communes pour le code postal 93420
SELECT nom, dep_code, region_code
FROM communes
WHERE code_postal = '93420';
