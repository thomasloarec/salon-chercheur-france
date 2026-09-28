-- Sécurité, lot B6, étape 3 : novelty_likes n'est plus lisible publiquement.
-- À appliquer APRÈS la mise en ligne du lot front B6-2 (comptages via
-- get_novelty_likes_count / get_novelty_likes_counts, fonctions SECURITY DEFINER).
-- Chaque utilisateur ne voit que ses propres enregistrements ; l'admin voit tout.
-- Les edge functions (novelty-like-toggle, novelty-milestone-check) utilisent la clé
-- service et ne sont pas concernées.

DROP POLICY IF EXISTS "Anyone can view likes" ON public.novelty_likes;

CREATE POLICY "Users can view their own likes"
  ON public.novelty_likes FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_admin());
