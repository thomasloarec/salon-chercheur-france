-- Remplir les exhibitor_id manquants avec matching flexible
UPDATE participation p
SET exhibitor_id = ex.id
FROM exhibitors ex
INNER JOIN exposants e ON LOWER(TRIM(e.nom_exposant)) = LOWER(TRIM(ex.name))
WHERE p.id_exposant = e.id_exposant
  AND p.exhibitor_id IS NULL
  AND ex.id IS NOT NULL;