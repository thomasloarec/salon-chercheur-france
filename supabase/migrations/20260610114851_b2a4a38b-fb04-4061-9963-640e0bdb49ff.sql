-- Helper d'accent-insensibilité sans dépendre de l'extension unaccent (créé en premier)
CREATE OR REPLACE FUNCTION public.unaccent_safe(txt text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT translate(
    txt,
    'àâäáãåçéèêëíìîïñóòôöõúùûüýÿ',
    'aaaaaaceeeeiiiinooooouuuuyy'
  );
$$;

-- Volet A : fonction immuable de détection des "refus" générés par l'IA
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
      'impossible.*(analys|qualifi)',
      'aucune description ni contenu web',
      'aucun contenu de site web.*fourni',
      'veuillez fournir.*(description|site web)'
    ])
  END;
$$;

-- Volet C.1 : table d'archive pour permettre un rollback des valeurs nettoyées
CREATE TABLE IF NOT EXISTS public.exhibitor_ai_refusal_archive (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  exhibitor_id text NOT NULL,
  resume_court text NOT NULL,
  archived_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.exhibitor_ai_refusal_archive TO authenticated;
GRANT ALL ON public.exhibitor_ai_refusal_archive TO service_role;

ALTER TABLE public.exhibitor_ai_refusal_archive ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read refusal archive"
ON public.exhibitor_ai_refusal_archive
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));