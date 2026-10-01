-- 20261001195659_prompt_generer_v3_activation.sql
-- Projet « Réduction longueur titre Nouveauté » (01/10/2026), lot A.
-- Active le prompt generer v3 après test du jeu de 7 cas (20 titres de 40 à 66 car.,
-- aucun obstacle inventé sur les 6 cas sans obstacle). Modèle observé : claude-opus-4-8.
-- Retour arrière : réactiver la v2 (même bloc en inversant les versions).

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.ai_editorial_prompts WHERE action='generer' AND version=3) THEN
    RAISE EXCEPTION 'generer v3 absente';
  END IF;
  UPDATE public.ai_editorial_prompts SET actif = false WHERE action = 'generer' AND actif = true AND version <> 3;
  UPDATE public.ai_editorial_prompts
     SET actif = true,
         model_validated_on = 'claude-opus-4-8',
         notes = notes || ' Activée le 01/10/2026 après test 7 cas (C1 SKIDEAU, C2 Azimut, C3 dégustation, C4 conférence, C5 coloris, C6 partenariat, C7 anniversaire) : 20 titres de 40 à 66 car., aucun obstacle inventé.'
   WHERE action = 'generer' AND version = 3;
  IF (SELECT count(*) FROM public.ai_editorial_prompts WHERE action='generer' AND actif) <> 1 THEN
    RAISE EXCEPTION 'il doit y avoir exactement une version active';
  END IF;
END $$;
