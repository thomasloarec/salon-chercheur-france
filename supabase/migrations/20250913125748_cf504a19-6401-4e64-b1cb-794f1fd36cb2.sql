-- Novelties Feature Migration
-- Create tables for exhibitors, novelties, user routes, and moderation

-- 1. Update profiles table to include role if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'role') THEN
        ALTER TABLE public.profiles ADD COLUMN role text DEFAULT 'user' CHECK (role IN ('admin', 'user'));
    END IF;
END $$;

-- 2. Create or update exhibitors table
CREATE TABLE IF NOT EXISTS public.exhibitors (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    slug text UNIQUE,
    website text,
    owner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    plan text DEFAULT 'free' CHECK (plan IN ('free', 'paid')),
    logo_url text,
    description text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 3. Create exhibitor claim requests table
CREATE TABLE IF NOT EXISTS public.exhibitor_claim_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    exhibitor_id uuid NOT NULL REFERENCES public.exhibitors(id) ON DELETE CASCADE,
    requester_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at timestamptz DEFAULT now(),
    UNIQUE(exhibitor_id, requester_user_id)
);

-- 4. Create exhibitor create requests table
CREATE TABLE IF NOT EXISTS public.exhibitor_create_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    proposed_name text NOT NULL,
    website text,
    requester_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at timestamptz DEFAULT now()
);

-- 5. Create user routes table
CREATE TABLE IF NOT EXISTS public.user_routes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    created_at timestamptz DEFAULT now(),
    UNIQUE(user_id, event_id)
);

-- 6. Create novelties table
CREATE TABLE IF NOT EXISTS public.novelties (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    exhibitor_id uuid NOT NULL REFERENCES public.exhibitors(id) ON DELETE CASCADE,
    title text NOT NULL,
    type text NOT NULL CHECK (type IN ('Launch', 'Prototype', 'MajorUpdate', 'LiveDemo', 'Partnership', 'Offer', 'Talk')),
    reason_1 text,
    reason_2 text,
    reason_3 text,
    audience_tags text[],
    media_urls text[] CHECK (array_length(media_urls, 1) <= 5),
    doc_url text,
    availability text,
    stand_info text,
    demo_slots jsonb,
    status text DEFAULT 'Published' CHECK (status IN ('Draft', 'UnderReview', 'Published')),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 7. Create route items table
CREATE TABLE IF NOT EXISTS public.route_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    route_id uuid NOT NULL REFERENCES public.user_routes(id) ON DELETE CASCADE,
    novelty_id uuid NOT NULL REFERENCES public.novelties(id) ON DELETE CASCADE,
    created_at timestamptz DEFAULT now(),
    UNIQUE(route_id, novelty_id)
);

-- 8. Create novelty stats table
CREATE TABLE IF NOT EXISTS public.novelty_stats (
    novelty_id uuid PRIMARY KEY REFERENCES public.novelties(id) ON DELETE CASCADE,
    route_users_count integer DEFAULT 0,
    reminders_count integer DEFAULT 0,
    saves_count integer DEFAULT 0,
    popularity_score numeric DEFAULT 0,
    updated_at timestamptz DEFAULT now()
);

-- 9. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_novelties_event_id ON public.novelties(event_id);
CREATE INDEX IF NOT EXISTS idx_novelties_exhibitor_id ON public.novelties(exhibitor_id);
CREATE INDEX IF NOT EXISTS idx_novelties_status ON public.novelties(status);
CREATE INDEX IF NOT EXISTS idx_novelty_stats_popularity ON public.novelty_stats(popularity_score DESC);
CREATE INDEX IF NOT EXISTS idx_user_routes_user_event ON public.user_routes(user_id, event_id);

-- 10. Enable RLS on all tables
ALTER TABLE public.exhibitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exhibitor_claim_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exhibitor_create_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.novelties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.route_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.novelty_stats ENABLE ROW LEVEL SECURITY;

-- 11. Create RLS policies for exhibitors
CREATE POLICY "Public read access to exhibitors" ON public.exhibitors
FOR SELECT USING (true);

CREATE POLICY "Admins can manage exhibitors" ON public.exhibitors
FOR ALL USING (is_admin());

CREATE POLICY "Owners can update their exhibitors" ON public.exhibitors
FOR UPDATE USING (owner_user_id = auth.uid())
WITH CHECK (owner_user_id = auth.uid());

-- 12. Create RLS policies for exhibitor_claim_requests
CREATE POLICY "Users can create claim requests" ON public.exhibitor_claim_requests
FOR INSERT WITH CHECK (requester_user_id = auth.uid());

CREATE POLICY "Users can view their own requests" ON public.exhibitor_claim_requests
FOR SELECT USING (requester_user_id = auth.uid() OR is_admin());

CREATE POLICY "Admins can manage claim requests" ON public.exhibitor_claim_requests
FOR ALL USING (is_admin());

-- 13. Create RLS policies for exhibitor_create_requests  
CREATE POLICY "Users can create exhibitor requests" ON public.exhibitor_create_requests
FOR INSERT WITH CHECK (requester_user_id = auth.uid());

CREATE POLICY "Users can view their own create requests" ON public.exhibitor_create_requests
FOR SELECT USING (requester_user_id = auth.uid() OR is_admin());

CREATE POLICY "Admins can manage create requests" ON public.exhibitor_create_requests
FOR ALL USING (is_admin());

-- 14. Create RLS policies for user_routes
CREATE POLICY "Users can manage their own routes" ON public.user_routes
FOR ALL USING (user_id = auth.uid() OR is_admin())
WITH CHECK (user_id = auth.uid() OR is_admin());

-- 15. Create RLS policies for novelties
CREATE POLICY "Public read access to published novelties" ON public.novelties
FOR SELECT USING (status = 'Published' OR is_admin() OR EXISTS (
    SELECT 1 FROM public.exhibitors e WHERE e.id = exhibitor_id AND e.owner_user_id = auth.uid()
));

CREATE POLICY "Admins can manage all novelties" ON public.novelties
FOR ALL USING (is_admin());

CREATE POLICY "Exhibitor owners can manage their novelties" ON public.novelties
FOR ALL USING (EXISTS (
    SELECT 1 FROM public.exhibitors e WHERE e.id = exhibitor_id AND e.owner_user_id = auth.uid()
)) WITH CHECK (EXISTS (
    SELECT 1 FROM public.exhibitors e WHERE e.id = exhibitor_id AND e.owner_user_id = auth.uid()
));

-- 16. Create RLS policies for route_items
CREATE POLICY "Users can manage their own route items" ON public.route_items
FOR ALL USING (EXISTS (
    SELECT 1 FROM public.user_routes ur WHERE ur.id = route_id AND (ur.user_id = auth.uid() OR is_admin())
)) WITH CHECK (EXISTS (
    SELECT 1 FROM public.user_routes ur WHERE ur.id = route_id AND (ur.user_id = auth.uid() OR is_admin())
));

-- 17. Create RLS policies for novelty_stats
CREATE POLICY "Public read access to novelty stats" ON public.novelty_stats
FOR SELECT USING (true);

CREATE POLICY "Service role can manage novelty stats" ON public.novelty_stats
FOR ALL USING (auth.role() = 'service_role');

-- 18. Create function to check if user can publish novelty
CREATE OR REPLACE FUNCTION public.can_publish_novelty(exhibitor_id uuid, event_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    exhibitor_plan text;
    novelty_count integer;
BEGIN
    -- Admins can always publish
    IF is_admin() THEN
        RETURN true;
    END IF;
    
    -- Get exhibitor plan
    SELECT plan INTO exhibitor_plan
    FROM public.exhibitors
    WHERE id = exhibitor_id;
    
    -- If paid plan, no limits
    IF exhibitor_plan = 'paid' THEN
        RETURN true;
    END IF;
    
    -- For free plan, check count of published novelties
    SELECT COUNT(*) INTO novelty_count
    FROM public.novelties
    WHERE exhibitor_id = can_publish_novelty.exhibitor_id
        AND event_id = can_publish_novelty.event_id
        AND status = 'Published';
    
    RETURN novelty_count = 0;
END;
$$;

-- 19. Create trigger function to update novelty stats
CREATE OR REPLACE FUNCTION public.update_novelty_stats()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Update stats for added novelty
        INSERT INTO public.novelty_stats (novelty_id, route_users_count, popularity_score, updated_at)
        VALUES (NEW.novelty_id, 1, 3, now())
        ON CONFLICT (novelty_id) DO UPDATE SET
            route_users_count = novelty_stats.route_users_count + 1,
            popularity_score = (novelty_stats.route_users_count + 1) * 3 + novelty_stats.reminders_count * 2 + novelty_stats.saves_count,
            updated_at = now();
    END IF;
    
    IF TG_OP = 'DELETE' THEN
        -- Update stats for removed novelty
        UPDATE public.novelty_stats SET
            route_users_count = GREATEST(0, route_users_count - 1),
            popularity_score = GREATEST(0, route_users_count - 1) * 3 + reminders_count * 2 + saves_count,
            updated_at = now()
        WHERE novelty_id = OLD.novelty_id;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$;

-- 20. Create trigger on route_items
CREATE TRIGGER update_novelty_stats_trigger
    AFTER INSERT OR DELETE ON public.route_items
    FOR EACH ROW EXECUTE FUNCTION public.update_novelty_stats();

-- 21. Create updated_at triggers
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER update_exhibitors_updated_at
    BEFORE UPDATE ON public.exhibitors
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_novelties_updated_at
    BEFORE UPDATE ON public.novelties
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 22. Create function to generate exhibitor slug
CREATE OR REPLACE FUNCTION public.generate_exhibitor_slug()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    IF NEW.slug IS NULL OR NEW.slug = '' THEN
        NEW.slug := lower(regexp_replace(NEW.name, '[^a-zA-Z0-9]+', '-', 'g'));
        NEW.slug := trim(both '-' from NEW.slug);
        
        -- Ensure uniqueness
        WHILE EXISTS (SELECT 1 FROM public.exhibitors WHERE slug = NEW.slug AND id != NEW.id) LOOP
            NEW.slug := NEW.slug || '-' || substr(NEW.id::text, 1, 8);
        END LOOP;
    END IF;
    
    RETURN NEW;
END;
$$;

CREATE TRIGGER generate_exhibitor_slug_trigger
    BEFORE INSERT OR UPDATE ON public.exhibitors
    FOR EACH ROW EXECUTE FUNCTION public.generate_exhibitor_slug();