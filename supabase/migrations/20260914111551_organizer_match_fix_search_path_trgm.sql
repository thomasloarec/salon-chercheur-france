-- Correctif : pg_trgm est installe dans le schema "extensions".
-- Le search_path fixe de la fonction (public seul) rendait word_similarity introuvable.
--
-- A noter : l'echec ne se produisait PAS a la creation de la fonction mais a son execution.
-- La migration precedente passait sans erreur alors que la fonction etait inutilisable.
--
-- On qualifie explicitement le schema plutot que d'elargir le search_path a l'aveugle,
-- et uniquement sur cette fonction, seule consommatrice de pg_trgm dans ce chantier.

ALTER FUNCTION public.organizer_match_exhibitor_list(uuid) SET search_path = public, extensions;
