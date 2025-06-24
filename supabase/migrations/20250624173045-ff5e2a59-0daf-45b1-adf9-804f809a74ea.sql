
-- Create user_crm_connections table for storing CRM OAuth tokens
CREATE TABLE public.user_crm_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  provider text NOT NULL CHECK (provider IN ('salesforce','hubspot','pipedrive','zoho')),
  access_token text NOT NULL,
  refresh_token text,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create unique index to prevent duplicate connections per user/provider
CREATE UNIQUE INDEX uniq_user_provider ON public.user_crm_connections(user_id, provider);

-- Create user_crm_companies table to track which companies belong to which users from CRM
CREATE TABLE public.user_crm_companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  provider text NOT NULL CHECK (provider IN ('salesforce','hubspot','pipedrive','zoho')),
  external_id text NOT NULL,
  last_synced_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, provider, external_id)
);

-- Enable RLS for user_crm_connections
ALTER TABLE public.user_crm_connections ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for user_crm_connections
CREATE POLICY "Users can manage their own CRM connections" 
  ON public.user_crm_connections 
  FOR ALL 
  USING (auth.uid() = user_id);

-- Enable RLS for user_crm_companies  
ALTER TABLE public.user_crm_companies ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for user_crm_companies
CREATE POLICY "Users can manage their own CRM companies" 
  ON public.user_crm_companies 
  FOR ALL 
  USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX idx_user_crm_connections_user_id ON public.user_crm_connections(user_id);
CREATE INDEX idx_user_crm_companies_user_id ON public.user_crm_companies(user_id);
CREATE INDEX idx_user_crm_companies_provider ON public.user_crm_companies(provider);

-- Add trigger to update updated_at on user_crm_connections
CREATE TRIGGER update_user_crm_connections_updated_at
  BEFORE UPDATE ON public.user_crm_connections
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
