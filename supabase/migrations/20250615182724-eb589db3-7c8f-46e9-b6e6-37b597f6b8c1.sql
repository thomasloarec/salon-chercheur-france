
-- Add policy to allow authenticated users to update events
-- This will enable admins to edit event details including image_url, description, etc.

CREATE POLICY "Allow authenticated users to update events" 
  ON public.events 
  FOR UPDATE 
  TO authenticated
  USING (true)
  WITH CHECK (true);
