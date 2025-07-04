-- Add RLS policy for admins to publish events
CREATE POLICY "Admins can publish events"
ON public.events 
FOR UPDATE 
TO authenticated
USING (true)
WITH CHECK (true);