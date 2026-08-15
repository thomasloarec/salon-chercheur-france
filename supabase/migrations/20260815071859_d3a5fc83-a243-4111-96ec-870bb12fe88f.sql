CREATE OR REPLACE FUNCTION public.leadmagnet_example_companies(p_n integer DEFAULT 3)
RETURNS TABLE(nom text, secteur text, nb_upcoming integer)
LANGUAGE sql
VOLATILE SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
  WITH upcoming AS (
    SELECT p.id_exposant, count(DISTINCT e.id) AS nb
    FROM participation p
    JOIN events e ON e.id = p.id_event
    WHERE coalesce(e.visible, false) = true
      AND e.is_test = false
      AND coalesce(e.date_fin, e.date_debut) >= current_date
    GROUP BY p.id_exposant
    HAVING count(DISTINCT e.id) >= 2
  ),
  pool AS (
    SELECT ex.nom_exposant AS nom, ai.secteur_principal AS secteur, u.nb::int AS nb_upcoming
    FROM upcoming u
    JOIN exposants ex        ON ex.id_exposant = u.id_exposant
    JOIN exhibitor_ai ai     ON ai.exhibitor_id = u.id_exposant
    WHERE coalesce(ex.is_canonical, true) = true
      AND char_length(ex.nom_exposant) BETWEEN 3 AND 28
      AND ai.secteur_principal IS NOT NULL
      AND ai.secteur_principal <> 'Non déterminé'
      AND u.nb >= 3
      AND EXISTS (SELECT 1 FROM exhibitor_embeddings em WHERE em.exhibitor_id = u.id_exposant)
  ),
  ranked AS (
    SELECT nom, secteur, nb_upcoming,
           row_number() OVER (PARTITION BY secteur ORDER BY nb_upcoming DESC, random()) AS rn
    FROM pool
  ),
  sampled AS (
    SELECT nom, secteur, nb_upcoming,
           row_number() OVER (PARTITION BY secteur ORDER BY random()) AS pick
    FROM ranked
    WHERE rn <= 5
  )
  SELECT nom, secteur, nb_upcoming
  FROM sampled
  WHERE pick = 1
  ORDER BY random()
  LIMIT greatest(p_n, 1);
$fn$;

GRANT EXECUTE ON FUNCTION public.leadmagnet_example_companies(integer)
  TO anon, authenticated, service_role, postgres;