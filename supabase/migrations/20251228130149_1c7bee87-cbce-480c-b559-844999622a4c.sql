-- Permettre aux visiteurs non connectés de voir les likes
DROP POLICY IF EXISTS "Users can view all likes" ON public.novelty_likes;
CREATE POLICY "Anyone can view likes" ON public.novelty_likes
FOR SELECT USING (true);

-- Aussi corriger la policy sur novelty_comments pour inclure le filtre is_test
DROP POLICY IF EXISTS "Anyone can view comments on published novelties" ON public.novelty_comments;
CREATE POLICY "Anyone can view comments on published novelties" ON public.novelty_comments
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM novelties n 
    WHERE n.id = novelty_comments.novelty_id 
    AND n.status = 'published' 
    AND n.is_test = false
  ) OR is_admin()
);