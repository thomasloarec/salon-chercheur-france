CREATE POLICY "Anyone can view profiles"
  ON public.profiles
  FOR SELECT
  TO anon, authenticated
  USING (true);