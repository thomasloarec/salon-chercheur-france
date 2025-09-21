-- Fix function search path security issues
CREATE OR REPLACE FUNCTION public.increment_novelty_stat(
  p_novelty_id uuid,
  p_field text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Validate field name
  IF p_field NOT IN ('likes', 'saves', 'resource_downloads', 'meeting_requests') THEN
    RAISE EXCEPTION 'Invalid field name: %', p_field;
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
$$;

CREATE OR REPLACE FUNCTION public.can_add_novelty(
  p_exhibitor_id uuid,
  p_user_id uuid
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  user_plan text;
  published_count integer;
BEGIN
  -- Check if user is admin
  IF public.is_admin() THEN
    RETURN true;
  END IF;
  
  -- Check if user owns the exhibitor
  IF NOT EXISTS (
    SELECT 1 FROM public.exhibitors 
    WHERE id = p_exhibitor_id AND owner_user_id = p_user_id
  ) THEN
    RETURN false;
  END IF;
  
  -- Get user plan (default to free)
  SELECT plan INTO user_plan
  FROM public.plans
  WHERE user_id = p_user_id;
  
  IF user_plan IS NULL THEN
    user_plan := 'free';
  END IF;
  
  -- If paid plan, no limits
  IF user_plan = 'paid' THEN
    RETURN true;
  END IF;
  
  -- For free plan, check published novelties count
  SELECT COUNT(*) INTO published_count
  FROM public.novelties
  WHERE exhibitor_id = p_exhibitor_id
    AND status = 'Published';
  
  RETURN published_count < 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER 
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;