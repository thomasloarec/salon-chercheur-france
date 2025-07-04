
-- Ensure admin can delete events from events table
CREATE POLICY IF NOT EXISTS "Admins can delete events" 
ON public.events 
FOR DELETE 
TO authenticated
USING (true);

-- Ensure service role can manage events_import table  
CREATE POLICY IF NOT EXISTS "Service role can manage events_import"
ON public.events_import
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
