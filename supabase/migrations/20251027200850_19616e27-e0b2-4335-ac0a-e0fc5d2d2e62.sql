-- Script de réparation des données existantes
-- Créer les entrées manquantes dans exposants pour tous les exhibitors

INSERT INTO exposants (id_exposant, nom_exposant, website_exposant, exposant_description)
SELECT 
  ex.id::text,
  ex.name,
  ex.website,
  ex.description
FROM exhibitors ex
WHERE NOT EXISTS (
  SELECT 1 FROM exposants e WHERE e.id_exposant = ex.id::text
)
ON CONFLICT (id_exposant) DO UPDATE SET
  nom_exposant = EXCLUDED.nom_exposant,
  website_exposant = EXCLUDED.website_exposant,
  exposant_description = EXCLUDED.exposant_description;

-- Réparer les participations en remplissant exhibitor_id
-- Méthode 1: Par correspondance exacte de nom
UPDATE participation p
SET exhibitor_id = ex.id
FROM exhibitors ex
WHERE p.exhibitor_id IS NULL
  AND EXISTS (
    SELECT 1 FROM exposants e 
    WHERE e.id_exposant = p.id_exposant 
    AND LOWER(TRIM(e.nom_exposant)) = LOWER(TRIM(ex.name))
  );

-- Méthode 2: Par correspondance de website
UPDATE participation p
SET exhibitor_id = ex.id
FROM exhibitors ex
WHERE p.exhibitor_id IS NULL
  AND p.website_exposant IS NOT NULL
  AND ex.website IS NOT NULL
  AND LOWER(TRIM(p.website_exposant)) = LOWER(TRIM(ex.website));

-- Mettre à jour id_exposant pour utiliser l'UUID quand exhibitor_id existe
UPDATE participation p
SET id_exposant = p.exhibitor_id::text
WHERE p.exhibitor_id IS NOT NULL
  AND p.id_exposant != p.exhibitor_id::text;