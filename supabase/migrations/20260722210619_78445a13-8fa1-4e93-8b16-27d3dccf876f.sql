BEGIN;

DROP FUNCTION IF EXISTS public.get_exhibitor_products(text);

CREATE FUNCTION public.get_exhibitor_products(p_public_slug text)
RETURNS TABLE (
  produits_services  jsonb,
  sous_secteurs      jsonb,
  secteur_principal  text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(ai.produits_services, '[]'::jsonb) AS produits_services,
    COALESCE(ai.sous_secteurs,     '[]'::jsonb) AS sous_secteurs,
    NULLIF(btrim(ai.secteur_principal), '')     AS secteur_principal
  FROM exhibitor_public_identities epi
  LEFT JOIN LATERAL (
    SELECT ai0.produits_services, ai0.sous_secteurs, ai0.secteur_principal
    FROM exhibitor_ai ai0
    WHERE (epi.exhibitor_id       IS NOT NULL AND ai0.exhibitor_id = epi.exhibitor_id::text)
       OR (epi.legacy_exposant_id IS NOT NULL AND ai0.exhibitor_id = epi.legacy_exposant_id)
    LIMIT 1
  ) ai ON true
  WHERE epi.public_slug = p_public_slug
    AND epi.is_active = true
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.get_exhibitor_products(text) IS
  'Champs structurés exhibitor_ai (produits/services, sous-secteurs, secteur) '
  'pour une fiche exposant publique, résolus par public_slug. Même logique de '
  'résolution que le LATERAL de public_exhibitor_profiles. Lecture seule, '
  'un slug à la fois : pas d''énumération de masse possible.';

REVOKE ALL ON FUNCTION public.get_exhibitor_products(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_exhibitor_products(text) TO anon, authenticated, service_role;

COMMIT;