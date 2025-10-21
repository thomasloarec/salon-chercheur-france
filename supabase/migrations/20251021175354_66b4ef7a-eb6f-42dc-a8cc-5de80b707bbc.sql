-- Add image support to novelty comments
ALTER TABLE public.novelty_comments 
ADD COLUMN image_url text;

-- Storage policy for comment images
CREATE POLICY "Users can upload their own comment images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'novelty-images' 
  AND auth.uid()::text = (storage.foldername(name))[1]
  AND (storage.foldername(name))[2] = 'comments'
);

CREATE POLICY "Comment images are publicly accessible"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'novelty-images' AND (storage.foldername(name))[2] = 'comments');