-- 20261001195320_prompt_generer_v3_titre_court.sql
-- Projet « Réduction longueur titre Nouveauté » (01/10/2026), lot A.
-- Crée la version 3 du prompt `generer` de novelty-ai-draft, dérivée de la v2,
-- avec la nouvelle règle de longueur de titre (cible 45 à 60, max 70).
-- Insérée INACTIVE : l'activation se fait après le test du jeu de cas.
-- La v2 est conservée telle quelle pour retour arrière.

DO $$
DECLARE
  v2 text;
  v3 text;
  old_title constant text := '- title : 60 à 90 caractères, sans nom de salon, sans date, sans point final, avec du vocabulaire métier concret.';
  new_title constant text := '- title : 45 à 60 caractères, 70 au grand maximum (limite dure du site, un titre plus long est refusé). Sans nom de salon, sans date, sans nom d''exposant, sans point final. L''objet concret (désignation, produit, démonstration, sujet) et le vocabulaire métier dans les premiers mots. Si c''est trop long, retire d''abord les compléments décoratifs, jamais la désignation. Compte les caractères avant de répondre.';
  old_trouv constant text := 'La narration et la mise en tension vivent dans reason_1, pas dans le titre.';
  new_trouv constant text := 'La narration et la mise en tension vivent dans reason_1, pas dans le titre. Le titre est court et dense : le nom de l''exposant et celui du salon sont ajoutés automatiquement autour de lui sur la page, ne les répète pas.';
BEGIN
  IF EXISTS (SELECT 1 FROM public.ai_editorial_prompts WHERE action = 'generer' AND version = 3) THEN
    RAISE EXCEPTION 'generer v3 existe déjà';
  END IF;

  SELECT prompt INTO v2 FROM public.ai_editorial_prompts WHERE action = 'generer' AND version = 2;
  IF v2 IS NULL THEN RAISE EXCEPTION 'generer v2 introuvable'; END IF;

  -- Chaque ancre doit exister exactement une fois.
  IF (length(v2) - length(replace(v2, old_title, ''))) / length(old_title) <> 1 THEN
    RAISE EXCEPTION 'ligne title v2 non trouvée exactement une fois';
  END IF;
  IF (length(v2) - length(replace(v2, old_trouv, ''))) / length(old_trouv) <> 1 THEN
    RAISE EXCEPTION 'phrase trouvabilité v2 non trouvée exactement une fois';
  END IF;

  v3 := replace(replace(v2, old_title, new_title), old_trouv, new_trouv);

  IF position('60 à 90' IN v3) > 0 OR position('45 à 60 caractères, 70 au grand maximum' IN v3) = 0 THEN
    RAISE EXCEPTION 'remplacement incomplet';
  END IF;

  INSERT INTO public.ai_editorial_prompts (action, version, prompt, model_validated_on, actif, notes)
  VALUES (
    'generer', 3, v3, NULL, false,
    'Version 3 (01/10/2026) : v2 + titre 45 à 60 caractères, 70 max, sans nom d''exposant ni de salon. Projet réduction longueur titre Nouveauté (alerte Google titre trop long). Inactive jusqu''au test du jeu de cas.'
  );
END $$;
