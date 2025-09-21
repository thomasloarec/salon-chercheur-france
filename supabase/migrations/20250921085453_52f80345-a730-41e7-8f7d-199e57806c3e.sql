-- Update exhibitors table
ALTER TABLE public.exhibitors 
ADD COLUMN IF NOT EXISTS approved boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS stand_info text;

-- Create exhibitor admin claims table
CREATE TABLE IF NOT EXISTS public.exhibitor_admin_claims (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  exhibitor_id uuid NOT NULL REFERENCES public.exhibitors(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  status text NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
  reason text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create novelty images table
CREATE TABLE IF NOT EXISTS public.novelty_images (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  novelty_id uuid NOT NULL REFERENCES public.novelties(id) ON DELETE CASCADE,
  url text NOT NULL,
  position integer NOT NULL CHECK (position >= 0 AND position <= 2),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(novelty_id, position)
);

-- Update novelties table
ALTER TABLE public.novelties
ADD COLUMN IF NOT EXISTS summary text,
ADD COLUMN IF NOT EXISTS details text,
ADD COLUMN IF NOT EXISTS images_count integer DEFAULT 0 CHECK (images_count >= 0 AND images_count <= 3),
ADD COLUMN IF NOT EXISTS resource_url text,
ADD COLUMN IF NOT EXISTS created_by uuid;

-- Create novelty stats table
CREATE TABLE IF NOT EXISTS public.novelty_stats (
  novelty_id uuid NOT NULL REFERENCES public.novelties(id) ON DELETE CASCADE PRIMARY KEY,
  likes integer NOT NULL DEFAULT 0,
  saves integer NOT NULL DEFAULT 0,
  resource_downloads integer NOT NULL DEFAULT 0,
  meeting_requests integer NOT NULL DEFAULT 0,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create leads table
CREATE TABLE IF NOT EXISTS public.leads (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  novelty_id uuid NOT NULL REFERENCES public.novelties(id) ON DELETE CASCADE,
  lead_type text NOT NULL CHECK (lead_type IN ('resource_download', 'meeting_request')),
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text NOT NULL,
  phone text,
  company text,
  role text,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create plans table
CREATE TABLE IF NOT EXISTS public.plans (
  user_id uuid NOT NULL PRIMARY KEY,
  plan text NOT NULL CHECK (plan IN ('free', 'paid')) DEFAULT 'free',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create storage buckets
INSERT INTO storage.buckets (id, name, public) 
VALUES ('novelty-images', 'novelty-images', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public) 
VALUES ('novelty-resources', 'novelty-resources', false)
ON CONFLICT (id) DO NOTHING;

-- RLS Policies for exhibitor_admin_claims
ALTER TABLE public.exhibitor_admin_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create claims for themselves" 
ON public.exhibitor_admin_claims 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own claims" 
ON public.exhibitor_admin_claims 
FOR SELECT 
USING (auth.uid() = user_id OR is_admin());

CREATE POLICY "Admins can manage all claims" 
ON public.exhibitor_admin_claims 
FOR ALL 
USING (is_admin());

-- RLS Policies for novelty_images
ALTER TABLE public.novelty_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read access to novelty images" 
ON public.novelty_images 
FOR SELECT 
USING (true);

CREATE POLICY "Exhibitor owners can manage their novelty images" 
ON public.novelty_images 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.novelties n 
    JOIN public.exhibitors e ON e.id = n.exhibitor_id 
    WHERE n.id = novelty_images.novelty_id 
    AND (e.owner_user_id = auth.uid() OR is_admin())
  )
);

-- RLS Policies for leads
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Exhibitor owners can view their leads" 
ON public.leads 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.novelties n 
    JOIN public.exhibitors e ON e.id = n.exhibitor_id 
    WHERE n.id = leads.novelty_id 
    AND (e.owner_user_id = auth.uid() OR is_admin())
  )
);

CREATE POLICY "Service role can create leads" 
ON public.leads 
FOR INSERT 
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Admins can manage all leads" 
ON public.leads 
FOR ALL 
USING (is_admin());

-- RLS Policies for plans
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own plan" 
ON public.plans 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own plan" 
ON public.plans 
FOR ALL 
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all plans" 
ON public.plans 
FOR ALL 
USING (is_admin());

-- Storage policies for novelty-images
CREATE POLICY "Public read access to novelty images" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'novelty-images');

CREATE POLICY "Authenticated users can upload novelty images" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'novelty-images' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can update their novelty images" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'novelty-images' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete their novelty images" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'novelty-images' AND auth.uid() IS NOT NULL);

-- Storage policies for novelty-resources
CREATE POLICY "Authenticated users can download resources" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'novelty-resources' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can upload resources" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'novelty-resources' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can update their resources" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'novelty-resources' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete their resources" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'novelty-resources' AND auth.uid() IS NOT NULL);

-- Utility functions
CREATE OR REPLACE FUNCTION public.increment_novelty_stat(
  p_novelty_id uuid,
  p_field text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
SET search_path = public
AS $$
DECLARE
  user_plan text;
  published_count integer;
BEGIN
  -- Check if user is admin
  IF is_admin() THEN
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

-- Add triggers for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_exhibitor_admin_claims_updated_at
    BEFORE UPDATE ON public.exhibitor_admin_claims
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_plans_updated_at
    BEFORE UPDATE ON public.plans
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();