-- Lot 4 correctif — performance du rapprochement.
--
-- Symptome : "canceling statement due to statement timeout" via PostgREST, alors que la
-- fonction passait en console (limite de temps plus permissive). Classique : le defaut
-- n'apparait que dans les conditions reelles d'appel.
--
-- Deux causes :
--  1. Les jointures par domaine appelaient normalize_domain / registrable_domain sur les
--     29 376 exposants, sans index exploitable. idx_exposants_normalized_domain porte sur
--     la COLONNE normalized_domain, NULL sur 46 % des lignes, donc inutilisable ici.
--  2. La recherche par nom utilisait word_similarity(...) >= seuil sur lower(nom_exposant).
--     word_similarity n'est pas un operateur indexable, et le lower() ne correspondait pas
--     a l'expression des index GIN existants. Resultat : balayage complet par ligne du
--     fichier, soit 94 x 29 376 comparaisons.
--
-- Correctif : index d'expression sur les deux fonctions de domaine, et (migration suivante)
-- passage a l'operateur <% qui sait utiliser l'index GIN trigramme deja present.

CREATE INDEX IF NOT EXISTS idx_exposants_normalize_domain_expr
  ON public.exposants (public.normalize_domain(website_exposant))
  WHERE is_canonical;

CREATE INDEX IF NOT EXISTS idx_exposants_registrable_domain_expr
  ON public.exposants (public.registrable_domain(website_exposant))
  WHERE is_canonical;

CREATE INDEX IF NOT EXISTS idx_participation_event_domain_expr
  ON public.participation (id_event, public.normalize_domain(website_exposant));

ANALYZE public.exposants;
