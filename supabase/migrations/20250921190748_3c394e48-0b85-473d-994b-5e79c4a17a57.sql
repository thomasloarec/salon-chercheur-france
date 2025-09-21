-- Migration: Moderation workflow for novelties and exhibitors

-- 1. Update novelties table for moderation workflow
ALTER TABLE public.novelties
  ALTER COLUMN status SET DEFAULT 'pending_admin_review';

-- Add check constraint for status values
ALTER TABLE public.novelties
  ADD CONSTRAINT novelties_status_check
  CHECK (status IN ('pending_admin_review','published','rejected'));

-- Create index for performance
CREATE INDEX IF NOT EXISTS novelties_status_idx ON public.novelties (status);

-- 2. Create novelty_likes table for like functionality
CREATE TABLE IF NOT EXISTS public.novelty_likes (
  novelty_id uuid NOT NULL REFERENCES public.novelties(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (novelty_id, user_id)
);

CREATE INDEX IF NOT EXISTS novelty_likes_novelty_idx ON public.novelty_likes (novelty_id);

-- 3. Update exhibitors table for approval workflow
ALTER TABLE public.exhibitors
  ADD COLUMN IF NOT EXISTS approved boolean DEFAULT false;

-- Create index for exhibitor approval filtering
CREATE INDEX IF NOT EXISTS exhibitors_approved_idx ON public.exhibitors (approved);

-- 4. Update RLS policies for novelty_likes
ALTER TABLE public.novelty_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can like/unlike novelties"
ON public.novelty_likes
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Like counts are publicly readable"
ON public.novelty_likes
FOR SELECT
USING (true);