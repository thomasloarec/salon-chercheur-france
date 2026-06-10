CREATE OR REPLACE FUNCTION public.is_ai_refusal(txt text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN txt IS NULL OR btrim(txt) = '' THEN false
    ELSE btrim(lower(public.unaccent_safe(txt))) ~ ANY (ARRAY[
      'donnees? insuffisantes',
      'informations? insuffisantes',
      'impossib[^.]{0,40}(analys|qualifi)',
      'aucune description ni contenu web',
      'aucun contenu de site web[^.]{0,40}fourni',
      'veuillez fournir[^.]{0,40}(description|site web)'
    ])
  END;
$$;