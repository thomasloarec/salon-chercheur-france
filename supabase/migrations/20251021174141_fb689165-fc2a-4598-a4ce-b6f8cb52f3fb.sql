-- Create storage bucket for profile avatars
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Add avatar_url column to profiles table if it doesn't exist
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Create novelty_comments table
CREATE TABLE IF NOT EXISTS public.novelty_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  novelty_id UUID NOT NULL REFERENCES public.novelties(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT content_length CHECK (char_length(content) > 0 AND char_length(content) <= 1000)
);

-- Enable RLS on novelty_comments
ALTER TABLE public.novelty_comments ENABLE ROW LEVEL SECURITY;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_novelty_comments_novelty_id ON public.novelty_comments(novelty_id);
CREATE INDEX IF NOT EXISTS idx_novelty_comments_created_at ON public.novelty_comments(created_at DESC);

-- RLS Policies for novelty_comments

-- Anyone can read comments on published novelties
CREATE POLICY "Anyone can view comments on published novelties"
ON public.novelty_comments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.novelties n
    WHERE n.id = novelty_comments.novelty_id
    AND (n.status = 'published' OR is_admin())
  )
);

-- Authenticated users can create comments
CREATE POLICY "Authenticated users can create comments"
ON public.novelty_comments
FOR INSERT
WITH CHECK (auth.uid() = user_id AND auth.uid() IS NOT NULL);

-- Users can update their own comments
CREATE POLICY "Users can update their own comments"
ON public.novelty_comments
FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own comments, admins can delete any
CREATE POLICY "Users can delete their own comments"
ON public.novelty_comments
FOR DELETE
USING (auth.uid() = user_id OR is_admin());

-- Storage policies for avatars bucket

-- Anyone can view avatars (public bucket)
CREATE POLICY "Anyone can view avatars"
ON storage.objects
FOR SELECT
USING (bucket_id = 'avatars');

-- Users can upload their own avatar
CREATE POLICY "Users can upload their own avatar"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
  AND (lower(storage.extension(name)) = 'jpg' 
    OR lower(storage.extension(name)) = 'jpeg' 
    OR lower(storage.extension(name)) = 'png' 
    OR lower(storage.extension(name)) = 'webp')
);

-- Users can update their own avatar
CREATE POLICY "Users can update their own avatar"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Users can delete their own avatar
CREATE POLICY "Users can delete their own avatar"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_novelty_comments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic timestamp updates
DROP TRIGGER IF EXISTS update_novelty_comments_updated_at ON public.novelty_comments;
CREATE TRIGGER update_novelty_comments_updated_at
BEFORE UPDATE ON public.novelty_comments
FOR EACH ROW
EXECUTE FUNCTION public.update_novelty_comments_updated_at();