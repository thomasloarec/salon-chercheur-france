
-- 1. Drop the overly permissive DELETE and UPDATE policies
DROP POLICY IF EXISTS "Users can delete their novelty images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their novelty images" ON storage.objects;

-- 2. DELETE policy: 3 path types handled
CREATE POLICY "Team members can delete novelty images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'novelty-images'
  AND auth.uid() IS NOT NULL
  AND (
    -- Admin bypass
    is_admin()
    -- Path type 1: {noveltyId}/... → team member of the exhibitor owning this novelty
    OR (
      (storage.foldername(name))[1] != 'exhibitor-logos'
      AND (storage.foldername(name))[2] IS DISTINCT FROM 'comments'
      AND EXISTS (
        SELECT 1 FROM novelties n
        WHERE n.id::text = (storage.foldername(name))[1]
          AND is_team_member(n.exhibitor_id)
      )
    )
    -- Path type 2: {userId}/comments/... → owner of the comment image
    OR (
      (storage.foldername(name))[2] = 'comments'
      AND auth.uid()::text = (storage.foldername(name))[1]
    )
    -- Path type 3: exhibitor-logos/{exhibitorId}/... → team member
    OR (
      (storage.foldername(name))[1] = 'exhibitor-logos'
      AND is_team_member((storage.foldername(name))[2]::uuid)
    )
  )
);

-- 3. UPDATE policy: same logic
CREATE POLICY "Team members can update novelty images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'novelty-images'
  AND auth.uid() IS NOT NULL
  AND (
    -- Admin bypass
    is_admin()
    -- Path type 1: {noveltyId}/...
    OR (
      (storage.foldername(name))[1] != 'exhibitor-logos'
      AND (storage.foldername(name))[2] IS DISTINCT FROM 'comments'
      AND EXISTS (
        SELECT 1 FROM novelties n
        WHERE n.id::text = (storage.foldername(name))[1]
          AND is_team_member(n.exhibitor_id)
      )
    )
    -- Path type 2: {userId}/comments/...
    OR (
      (storage.foldername(name))[2] = 'comments'
      AND auth.uid()::text = (storage.foldername(name))[1]
    )
    -- Path type 3: exhibitor-logos/{exhibitorId}/...
    OR (
      (storage.foldername(name))[1] = 'exhibitor-logos'
      AND is_team_member((storage.foldername(name))[2]::uuid)
    )
  )
);
