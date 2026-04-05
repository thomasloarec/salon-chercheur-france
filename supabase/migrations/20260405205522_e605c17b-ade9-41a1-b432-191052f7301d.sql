-- Add MIME type and file size restrictions to novelty-images bucket
UPDATE storage.buckets 
SET 
  file_size_limit = 5242880,  -- 5 MB
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp']
WHERE id = 'novelty-images';

-- Add MIME type and file size restrictions to novelty-resources bucket
UPDATE storage.buckets 
SET 
  file_size_limit = 20971520,  -- 20 MB
  allowed_mime_types = ARRAY['application/pdf']
WHERE id = 'novelty-resources';
