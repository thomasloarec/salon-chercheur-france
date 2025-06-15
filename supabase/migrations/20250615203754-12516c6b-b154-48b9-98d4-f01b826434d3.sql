
-- Add RLS policy to allow authenticated users to delete events
CREATE POLICY "Allow authenticated users to delete events"
  ON public.events
  FOR DELETE
  TO authenticated
  USING (true);
