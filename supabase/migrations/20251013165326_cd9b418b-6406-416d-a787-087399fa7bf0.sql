-- Table pour stocker les likes des nouveautés
CREATE TABLE IF NOT EXISTS novelty_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  novelty_id UUID NOT NULL REFERENCES novelties(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, novelty_id)
);

-- Index pour performance
CREATE INDEX idx_novelty_likes_user ON novelty_likes(user_id);
CREATE INDEX idx_novelty_likes_novelty ON novelty_likes(novelty_id);

-- RLS : Un utilisateur peut gérer ses propres likes
ALTER TABLE novelty_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all likes"
  ON novelty_likes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert their own likes"
  ON novelty_likes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own likes"
  ON novelty_likes FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Fonction pour compter les likes d'une nouveauté
CREATE OR REPLACE FUNCTION get_novelty_likes_count(novelty_uuid UUID)
RETURNS INTEGER AS $$
  SELECT COUNT(*)::INTEGER
  FROM novelty_likes
  WHERE novelty_id = novelty_uuid;
$$ LANGUAGE SQL STABLE;