-- BLOC 3a : vue publique minimale pour l'affichage des auteurs de commentaires.
-- Mode SECURITY DEFINER DELIBERE et documente : n'expose que prenom, initiale
-- du nom et avatar. Permet de fermer la lecture publique de public.profiles.
-- Migration purement additive.

CREATE OR REPLACE VIEW public.public_comment_authors AS
SELECT
  p.user_id,
  NULLIF(btrim(p.first_name), '') AS first_name,
  CASE
    WHEN NULLIF(btrim(p.last_name), '') IS NOT NULL
    THEN upper(left(btrim(p.last_name), 1)) || '.'
    ELSE NULL
  END AS last_initial,
  p.avatar_url
FROM public.profiles p;

REVOKE ALL ON public.public_comment_authors FROM anon, authenticated;
GRANT SELECT ON public.public_comment_authors TO anon, authenticated;

COMMENT ON VIEW public.public_comment_authors IS
  'Vue publique minimale des auteurs de commentaires : prenom, initiale du nom, avatar. SECURITY DEFINER delibere afin de permettre la fermeture de la lecture publique de profiles. Ne jamais y ajouter de colonne sans revue securite.';

