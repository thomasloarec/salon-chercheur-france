-- PHASE 1 : NETTOYAGE DES DOUBLONS EXHIBITORS

-- Créer une table temporaire avec le meilleur exhibitor pour chaque nom
CREATE TEMP TABLE best_exhibitors AS
WITH ranked_exhibitors AS (
  SELECT 
    id,
    name,
    LOWER(TRIM(name)) as normalized_name,
    logo_url,
    description,
    website,
    created_at,
    (CASE WHEN logo_url IS NOT NULL THEN 10 ELSE 0 END) +
    (CASE WHEN description IS NOT NULL THEN 10 ELSE 0 END) +
    (CASE WHEN website IS NOT NULL THEN 5 ELSE 0 END) +
    (CASE WHEN created_at < NOW() - INTERVAL '30 days' THEN 1 ELSE 0 END) as score,
    ROW_NUMBER() OVER (
      PARTITION BY LOWER(TRIM(name))
      ORDER BY 
        (CASE WHEN logo_url IS NOT NULL THEN 10 ELSE 0 END) +
        (CASE WHEN description IS NOT NULL THEN 10 ELSE 0 END) +
        (CASE WHEN website IS NOT NULL THEN 5 ELSE 0 END) DESC,
        created_at ASC
    ) as rank
  FROM exhibitors
)
SELECT * FROM ranked_exhibitors WHERE rank = 1;

-- Fusionner les participations vers le meilleur exhibitor
UPDATE participation p
SET exhibitor_id = be.id
FROM exhibitors ex
JOIN best_exhibitors be ON LOWER(TRIM(be.name)) = LOWER(TRIM(ex.name))
WHERE p.exhibitor_id = ex.id
  AND ex.id != be.id
  AND be.id IS NOT NULL;

-- Fusionner les novelties
UPDATE novelties n
SET exhibitor_id = be.id
FROM exhibitors ex
JOIN best_exhibitors be ON LOWER(TRIM(be.name)) = LOWER(TRIM(ex.name))
WHERE n.exhibitor_id = ex.id
  AND ex.id != be.id;

-- Pour exhibitor_claim_requests : supprimer les doublons avant l'update
DELETE FROM exhibitor_claim_requests ecr
WHERE ecr.id IN (
  SELECT ecr2.id
  FROM exhibitor_claim_requests ecr2
  JOIN exhibitors ex ON ex.id = ecr2.exhibitor_id
  JOIN best_exhibitors be ON LOWER(TRIM(be.name)) = LOWER(TRIM(ex.name))
  WHERE ex.id != be.id
    AND EXISTS (
      SELECT 1 FROM exhibitor_claim_requests ecr3
      WHERE ecr3.exhibitor_id = be.id
        AND ecr3.requester_user_id = ecr2.requester_user_id
    )
);

-- Maintenant on peut faire l'update sans conflit
UPDATE exhibitor_claim_requests ecr
SET exhibitor_id = be.id
FROM exhibitors ex
JOIN best_exhibitors be ON LOWER(TRIM(be.name)) = LOWER(TRIM(ex.name))
WHERE ecr.exhibitor_id = ex.id
  AND ex.id != be.id;

-- Fusionner premium_entitlements (même logique)
DELETE FROM premium_entitlements pe
WHERE pe.id IN (
  SELECT pe2.id
  FROM premium_entitlements pe2
  JOIN exhibitors ex ON ex.id = pe2.exhibitor_id
  JOIN best_exhibitors be ON LOWER(TRIM(be.name)) = LOWER(TRIM(ex.name))
  WHERE ex.id != be.id
    AND EXISTS (
      SELECT 1 FROM premium_entitlements pe3
      WHERE pe3.exhibitor_id = be.id
        AND pe3.event_id = pe2.event_id
    )
);

UPDATE premium_entitlements pe
SET exhibitor_id = be.id
FROM exhibitors ex
JOIN best_exhibitors be ON LOWER(TRIM(be.name)) = LOWER(TRIM(ex.name))
WHERE pe.exhibitor_id = ex.id
  AND ex.id != be.id;

-- Consolider les données manquantes dans le meilleur exhibitor
UPDATE exhibitors ex
SET 
  logo_url = COALESCE(ex.logo_url, dup.logo_url),
  description = COALESCE(ex.description, dup.description),
  website = COALESCE(ex.website, dup.website)
FROM (
  SELECT DISTINCT ON (LOWER(TRIM(name)))
    LOWER(TRIM(name)) as normalized_name,
    logo_url,
    description,
    website
  FROM exhibitors
  WHERE logo_url IS NOT NULL OR description IS NOT NULL OR website IS NOT NULL
) dup
WHERE LOWER(TRIM(ex.name)) = dup.normalized_name
  AND (ex.logo_url IS NULL OR ex.description IS NULL OR ex.website IS NULL);

-- Supprimer les doublons maintenant orphelins
DELETE FROM exhibitors ex
WHERE ex.id NOT IN (SELECT id FROM best_exhibitors)
  AND EXISTS (
    SELECT 1 FROM best_exhibitors be 
    WHERE LOWER(TRIM(be.name)) = LOWER(TRIM(ex.name))
  );

-- PHASE 2 : RECONSTRUCTION DE LA VUE ET RESTAURATION DES DESCRIPTIONS

-- Supprimer l'ancienne vue
DROP VIEW IF EXISTS participations_with_exhibitors CASCADE;

-- Créer la vue moderne qui utilise exhibitors en priorité
CREATE OR REPLACE VIEW participations_with_exhibitors AS
SELECT 
  p.id_participation,
  p.id_event,
  p.id_event_text,
  p.stand_exposant,
  p.urlexpo_event,
  p.website_exposant as participation_website,
  
  ex.id as exhibitor_uuid,
  ex.name as exhibitor_name,
  ex.website as exhibitor_website,
  ex.description as exposant_description,
  ex.logo_url,
  ex.approved,
  ex.plan,
  ex.stand_info,
  
  CASE 
    WHEN ex.id IS NOT NULL THEN ex.name
    ELSE old.nom_exposant
  END as name_final,
  
  CASE 
    WHEN ex.id IS NOT NULL THEN ex.website
    WHEN old.website_exposant IS NOT NULL THEN old.website_exposant
    ELSE p.website_exposant
  END as website_final,
  
  CASE 
    WHEN ex.id IS NOT NULL THEN ex.description
    ELSE old.exposant_description
  END as description_final,
  
  p.id_exposant,
  old.nom_exposant as legacy_name,
  old.website_exposant as legacy_website,
  old.exposant_description as legacy_description

FROM participation p
LEFT JOIN exhibitors ex ON ex.id = p.exhibitor_id
LEFT JOIN exposants old ON old.id_exposant = p.id_exposant 
  AND p.exhibitor_id IS NULL;

-- Restaurer les descriptions depuis exposants vers exhibitors
UPDATE exhibitors ex
SET 
  description = old.exposant_description,
  updated_at = NOW()
FROM exposants old
JOIN participation p ON p.id_exposant = old.id_exposant
WHERE p.exhibitor_id = ex.id
  AND ex.description IS NULL
  AND old.exposant_description IS NOT NULL
  AND LENGTH(TRIM(old.exposant_description)) > 10;

-- Restaurer les websites manquants
UPDATE exhibitors ex
SET 
  website = old.website_exposant,
  updated_at = NOW()
FROM exposants old
JOIN participation p ON p.id_exposant = old.id_exposant
WHERE p.exhibitor_id = ex.id
  AND (ex.website IS NULL OR ex.website = '')
  AND old.website_exposant IS NOT NULL
  AND old.website_exposant != '';

-- Nettoyer la table temporaire
DROP TABLE IF EXISTS best_exhibitors;