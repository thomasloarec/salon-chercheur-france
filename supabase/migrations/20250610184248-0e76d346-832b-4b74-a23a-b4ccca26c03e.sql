
-- Phase 1: Critical RLS Policy Implementation (Corrected)

-- First, add user_id column to alerts table to properly associate alerts with users
ALTER TABLE public.alerts 
ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Enable RLS on alerts table
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for alerts table
CREATE POLICY "Users can view their own alerts" 
  ON public.alerts 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own alerts" 
  ON public.alerts 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own alerts" 
  ON public.alerts 
  FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own alerts" 
  ON public.alerts 
  FOR DELETE 
  USING (auth.uid() = user_id);

-- Enable RLS on companies table (public read, restricted write)
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- Allow public read access to companies for discovery
CREATE POLICY "Public read access to companies" 
  ON public.companies 
  FOR SELECT 
  TO authenticated, anon
  USING (true);

-- Restrict write access to companies (only authenticated users can create)
CREATE POLICY "Authenticated users can create companies" 
  ON public.companies 
  FOR INSERT 
  TO authenticated
  WITH CHECK (true);

-- Enable RLS on event_exhibitors table
ALTER TABLE public.event_exhibitors ENABLE ROW LEVEL SECURITY;

-- Allow public read access to event_exhibitors for discovery
CREATE POLICY "Public read access to event_exhibitors" 
  ON public.event_exhibitors 
  FOR SELECT 
  TO authenticated, anon
  USING (true);

-- Restrict write access to event_exhibitors (system/admin only)
CREATE POLICY "System can manage event_exhibitors" 
  ON public.event_exhibitors 
  FOR ALL 
  TO service_role
  USING (true);

-- Enable RLS on events table with proper write restrictions
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- Allow public read access to events
CREATE POLICY "Public read access to events" 
  ON public.events 
  FOR SELECT 
  TO authenticated, anon
  USING (true);

-- Restrict write access to events (system/service role only for scraping)
CREATE POLICY "Service role can manage events" 
  ON public.events 
  FOR ALL 
  TO service_role
  USING (true);

-- Enable RLS on sectors table
ALTER TABLE public.sectors ENABLE ROW LEVEL SECURITY;

-- Allow public read access to sectors
CREATE POLICY "Public read access to sectors" 
  ON public.sectors 
  FOR SELECT 
  TO authenticated, anon
  USING (true);

-- Enable RLS on scraping_sources table
ALTER TABLE public.scraping_sources ENABLE ROW LEVEL SECURITY;

-- Allow public read access to scraping_sources
CREATE POLICY "Public read access to scraping_sources" 
  ON public.scraping_sources 
  FOR SELECT 
  TO authenticated, anon
  USING (true);

-- Restrict write access to scraping_sources (service role only)
CREATE POLICY "Service role can manage scraping_sources" 
  ON public.scraping_sources 
  FOR ALL 
  TO service_role
  USING (true);

-- Add indexes for performance on user_id columns (skip if they exist)
CREATE INDEX IF NOT EXISTS idx_alerts_user_id ON public.alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_user_companies_user_id ON public.user_companies(user_id);
-- Skip idx_exhibitor_matches_user_id as it already exists
