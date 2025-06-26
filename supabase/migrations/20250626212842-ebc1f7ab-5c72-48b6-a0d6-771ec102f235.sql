
-- Mettre à jour la fonction get_location_suggestions pour gérer les espaces et tirets
CREATE OR REPLACE FUNCTION public.get_location_suggestions(q text)
RETURNS TABLE (
  rank integer,
  type text,
  label text,
  value text
) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  WITH input AS (
    SELECT LOWER(unaccent(
      regexp_replace(q, '[\s\u00A0\-\–\—]', '', 'g')
    )) AS q_norm
  ),
  ranked AS (
    -- 1. Ville : priorité absolue (rank 1)
    SELECT 1 AS rank, 'city' AS type,
           c.nom AS label, c.nom AS value
    FROM   communes c, input i
    WHERE  regexp_replace(LOWER(unaccent(c.nom)), '[\s\u00A0\-\–\—]', '', 'g') 
           ILIKE '%' || i.q_norm || '%'

    UNION
    -- 2. Département (rank 2)
    SELECT 2, 'department',
           d.nom, d.code
    FROM   departements d, input i
    WHERE  regexp_replace(LOWER(unaccent(d.nom)), '[\s\u00A0\-\–\—]', '', 'g')
           ILIKE '%' || i.q_norm || '%'

    UNION
    -- 3. Région (rank 3)
    SELECT 3, 'region',
           r.nom, r.code
    FROM   regions r, input i
    WHERE  regexp_replace(LOWER(unaccent(r.nom)), '[\s\u00A0\-\–\—]', '', 'g')
           ILIKE '%' || i.q_norm || '%'
  )
  SELECT DISTINCT ON (label) ranked.*
  FROM   ranked
  ORDER  BY label, rank;
END;
$$;
