-- Lot 0 — Import listes exposants organisateur
-- Ajoute registrable_domain() : reduction d'une URL a son domaine enregistrable.
-- N'ALTERE PAS normalize_domain(), utilisee en production par load_participations_from_staging().

CREATE OR REPLACE FUNCTION public.registrable_domain(input_url text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  d         text;
  parts     text[];
  n         int;
  two_level text[] := ARRAY[
    'co.uk','org.uk','ac.uk','gov.uk','me.uk',
    'com.br','com.au','net.au','org.au','co.jp','co.nz','co.za','com.mx','com.tr','com.cn','com.es',
    'asso.fr','tm.fr','nom.fr','prd.fr','com.fr','gouv.fr',
    'co.it','com.pl','com.pt','com.ua','com.ar','com.sg','com.hk','co.kr','co.in','com.my'
  ];
BEGIN
  d := public.normalize_domain(input_url);
  IF d IS NULL THEN
    RETURN NULL;
  END IF;

  -- Une adresse IPv4 n'a pas de domaine enregistrable
  IF d ~ '^[0-9]+(\.[0-9]+){3}$' THEN
    RETURN NULL;
  END IF;

  parts := string_to_array(d, '.');
  n := array_length(parts, 1);

  IF n IS NULL OR n < 2 THEN
    RETURN NULL;
  END IF;

  -- Suffixe a deux niveaux connu : on garde trois etiquettes
  IF n >= 3 AND (parts[n-1] || '.' || parts[n]) = ANY(two_level) THEN
    RETURN array_to_string(parts[n-2:n], '.');
  END IF;

  RETURN array_to_string(parts[n-1:n], '.');
END;
$$;

COMMENT ON FUNCTION public.registrable_domain(text) IS
  'Reduit une URL a son domaine enregistrable (sous-domaines retires). Utilise par le matching des listes exposants organisateur. Ne pas confondre avec normalize_domain(), qui conserve les sous-domaines et sert au pipeline Airtable.';

REVOKE EXECUTE ON FUNCTION public.registrable_domain(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.registrable_domain(text) FROM anon;
GRANT  EXECUTE ON FUNCTION public.registrable_domain(text) TO authenticated, service_role;
