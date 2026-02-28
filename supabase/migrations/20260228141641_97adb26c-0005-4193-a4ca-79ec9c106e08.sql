
-- Create storage bucket for blog images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('blog-images', 'blog-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- Allow admins to upload blog images
CREATE POLICY "Admins can upload blog images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'blog-images' AND (SELECT is_admin()));

-- Allow admins to update blog images
CREATE POLICY "Admins can update blog images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'blog-images' AND (SELECT is_admin()));

-- Allow admins to delete blog images
CREATE POLICY "Admins can delete blog images"
ON storage.objects FOR DELETE
USING (bucket_id = 'blog-images' AND (SELECT is_admin()));

-- Public read access for blog images
CREATE POLICY "Public read blog images"
ON storage.objects FOR SELECT
USING (bucket_id = 'blog-images');
