-- ============================================================================
-- CRITICAL SECURITY FIXES - Phase 1: Database Security
-- ============================================================================

-- SECTION 1: Enable RLS on all unprotected tables
-- ------------------------------------------------
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.participation_import_errors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events_geo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events_import ENABLE ROW LEVEL SECURITY;

-- SECTION 2: Create user roles system
-- -----------------------------------
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Add role column to profiles for easier access
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role app_role DEFAULT 'user';

-- SECTION 3: Security definer functions for role checking
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  ) OR EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE user_id = _user_id
      AND role = _role
  );
$$;

CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS app_role
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT role FROM public.profiles WHERE user_id = auth.uid()),
    'user'::app_role
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.has_role(auth.uid(), 'admin'::app_role);
$$;

-- SECTION 4: RLS Policies for events table
-- ----------------------------------------
CREATE POLICY "Events are publicly readable"
ON public.events
FOR SELECT
USING (visible = true OR public.is_admin());

CREATE POLICY "Admins can manage all events"
ON public.events
FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "Service role can manage events"
ON public.events
FOR ALL
USING (auth.role() = 'service_role');

-- SECTION 5: RLS Policies for geographic data
-- -------------------------------------------
CREATE POLICY "Geographic data is publicly readable"
ON public.regions
FOR SELECT
USING (true);

CREATE POLICY "Geographic data is publicly readable"
ON public.departements
FOR SELECT
USING (true);

CREATE POLICY "Geographic data is publicly readable"
ON public.communes
FOR SELECT
USING (true);

CREATE POLICY "Geographic data is publicly readable"
ON public.events_geo
FOR SELECT
USING (true);

-- Admin write access for geographic data
CREATE POLICY "Admins can manage regions"
ON public.regions
FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "Admins can manage departements"
ON public.departements
FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "Admins can manage communes"
ON public.communes
FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "Admins can manage events_geo"
ON public.events_geo
FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- SECTION 6: RLS Policies for import tables
-- -----------------------------------------
CREATE POLICY "Admins can manage events_import"
ON public.events_import
FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "Admins can view import errors"
ON public.participation_import_errors
FOR SELECT
USING (public.is_admin());

CREATE POLICY "Service role can manage import errors"
ON public.participation_import_errors
FOR ALL
USING (auth.role() = 'service_role');

-- SECTION 7: RLS Policies for user_roles
-- --------------------------------------
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all roles"
ON public.user_roles
FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- SECTION 8: Fix existing database functions with proper search_path
-- -----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.toggle_favorite(p_event uuid)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF EXISTS(SELECT 1 FROM public.favorites WHERE user_id = auth.uid() AND event_id = p_event) THEN
    DELETE FROM public.favorites WHERE user_id = auth.uid() AND event_id = p_event;
  ELSE
    INSERT INTO public.favorites(user_id, event_id) VALUES (auth.uid(), p_event);
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, first_name, last_name, role)
  VALUES (
    new.id,
    new.raw_user_meta_data ->> 'first_name',
    new.raw_user_meta_data ->> 'last_name',
    'user'::app_role
  );
  RETURN new;
END;
$function$;

CREATE OR REPLACE FUNCTION public.generate_event_slug(event_name text, event_city text, event_year integer)
RETURNS TEXT
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
    clean_name text;
    clean_city text;
    slug text;
BEGIN
    clean_name := lower(event_name);
    clean_name := unaccent(clean_name);
    clean_name := regexp_replace(clean_name, '''', '', 'g');
    clean_name := regexp_replace(clean_name, '[^a-z0-9 -]', '', 'g');
    clean_name := regexp_replace(clean_name, ' +', '-', 'g');
    clean_name := regexp_replace(clean_name, '-+', '-', 'g');
    clean_name := trim(both '-' from clean_name);
    
    clean_city := lower(event_city);
    clean_city := unaccent(clean_city);
    clean_city := regexp_replace(clean_city, '''', '', 'g');
    clean_city := regexp_replace(clean_city, '[^a-z0-9]', '', 'g');
    
    slug := clean_name || '-' || event_year || '-' || clean_city;
    
    RETURN slug;
END;
$function$;

-- SECTION 9: Create initial admin user trigger
-- --------------------------------------------
CREATE OR REPLACE FUNCTION public.create_initial_admin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Make the first user with admin email an admin
  IF NEW.email = 'admin@salonspro.com' THEN
    UPDATE public.profiles 
    SET role = 'admin'::app_role 
    WHERE user_id = NEW.id;
    
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin'::app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Apply the trigger to existing and new users
DROP TRIGGER IF EXISTS create_initial_admin_trigger ON auth.users;
CREATE TRIGGER create_initial_admin_trigger
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.create_initial_admin();

-- Update existing admin user if exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = 'admin@salonspro.com') THEN
    UPDATE public.profiles 
    SET role = 'admin'::app_role 
    WHERE user_id = (SELECT id FROM auth.users WHERE email = 'admin@salonspro.com');
    
    INSERT INTO public.user_roles (user_id, role)
    SELECT id, 'admin'::app_role 
    FROM auth.users 
    WHERE email = 'admin@salonspro.com'
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
END $$;

-- SECTION 10: Verification
-- ------------------------
SELECT 'RLS enabled on tables:' as status;
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND rowsecurity = true;

SELECT 'Admin roles created:' as status;
SELECT COUNT(*) as admin_count 
FROM public.user_roles 
WHERE role = 'admin';