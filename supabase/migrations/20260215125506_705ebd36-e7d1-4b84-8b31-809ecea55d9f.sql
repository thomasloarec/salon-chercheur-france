
-- 1. Harden increment_novelty_stat: validate novelty exists and is published
CREATE OR REPLACE FUNCTION public.increment_novelty_stat(p_novelty_id uuid, p_field text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Validate field name
  IF p_field NOT IN ('likes', 'saves', 'resource_downloads', 'meeting_requests') THEN
    RAISE EXCEPTION 'Invalid field name: %', p_field;
  END IF;

  -- Validate novelty exists and is published
  IF NOT EXISTS (
    SELECT 1 FROM public.novelties
    WHERE id = p_novelty_id AND status = 'published'
  ) THEN
    RAISE EXCEPTION 'Novelty not found or not published: %', p_novelty_id;
  END IF;

  -- Insert or update stats
  INSERT INTO public.novelty_stats (novelty_id, updated_at)
  VALUES (p_novelty_id, now())
  ON CONFLICT (novelty_id) DO UPDATE SET
    likes = CASE WHEN p_field = 'likes' THEN novelty_stats.likes + 1 ELSE novelty_stats.likes END,
    saves = CASE WHEN p_field = 'saves' THEN novelty_stats.saves + 1 ELSE novelty_stats.saves END,
    resource_downloads = CASE WHEN p_field = 'resource_downloads' THEN novelty_stats.resource_downloads + 1 ELSE novelty_stats.resource_downloads END,
    meeting_requests = CASE WHEN p_field = 'meeting_requests' THEN novelty_stats.meeting_requests + 1 ELSE novelty_stats.meeting_requests END,
    updated_at = now();
END;
$function$;

-- 2. Fix overly permissive RLS on events_old
DROP POLICY IF EXISTS "Admins can publish events" ON public.events_old;
DROP POLICY IF EXISTS "Allow authenticated users to delete events" ON public.events_old;
DROP POLICY IF EXISTS "Allow authenticated users to update events" ON public.events_old;
DROP POLICY IF EXISTS "Service role can manage events" ON public.events_old;
-- Keep only one public SELECT and add restricted management
DROP POLICY IF EXISTS "Events are publicly readable" ON public.events_old;

CREATE POLICY "Public read access events_old" ON public.events_old
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage events_old" ON public.events_old
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "Service role manages events_old" ON public.events_old
  FOR ALL USING (auth.role() = 'service_role'::text);

-- 3. Fix overly permissive RLS on exposants
DROP POLICY IF EXISTS "Allow authenticated users to manage exposants" ON public.exposants;
DROP POLICY IF EXISTS "Authenticated users can manage exposants" ON public.exposants;
DROP POLICY IF EXISTS "Allow public read access to exposants" ON public.exposants;
DROP POLICY IF EXISTS "Public read access to exposants" ON public.exposants;
DROP POLICY IF EXISTS "Public read on exposants" ON public.exposants;

CREATE POLICY "Public read exposants" ON public.exposants
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage exposants" ON public.exposants
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "Service role manages exposants" ON public.exposants
  FOR ALL USING (auth.role() = 'service_role'::text);

-- 4. Fix overly permissive RLS on participation
DROP POLICY IF EXISTS "Allow authenticated users to manage participation" ON public.participation;
DROP POLICY IF EXISTS "Authenticated users can manage participation" ON public.participation;
DROP POLICY IF EXISTS "Allow public read access to participation" ON public.participation;
DROP POLICY IF EXISTS "Public read access to participation" ON public.participation;
DROP POLICY IF EXISTS "Public read on participation" ON public.participation;

CREATE POLICY "Public read participation" ON public.participation
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage participation" ON public.participation
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "Service role manages participation" ON public.participation
  FOR ALL USING (auth.role() = 'service_role'::text);
