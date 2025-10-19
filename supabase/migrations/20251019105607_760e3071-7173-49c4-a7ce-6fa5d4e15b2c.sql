-- Create premium_entitlements table for per-event Premium access
CREATE TABLE IF NOT EXISTS public.premium_entitlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exhibitor_id UUID NOT NULL REFERENCES public.exhibitors(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  max_novelties INT NOT NULL DEFAULT 5,
  leads_unlimited BOOLEAN NOT NULL DEFAULT true,
  csv_export BOOLEAN NOT NULL DEFAULT true,
  granted_by UUID NOT NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ NULL,
  notes TEXT NULL
);

-- Create partial unique index for active entitlements only
CREATE UNIQUE INDEX idx_unique_active_entitlement 
ON public.premium_entitlements(exhibitor_id, event_id) 
WHERE revoked_at IS NULL;

-- Create index for efficient lookups
CREATE INDEX idx_premium_entitlements_lookup 
ON public.premium_entitlements(exhibitor_id, event_id);

-- Enable RLS
ALTER TABLE public.premium_entitlements ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own entitlements or admins can view all
CREATE POLICY "Users can view their entitlements or admins view all"
ON public.premium_entitlements
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.exhibitors e
    WHERE e.id = premium_entitlements.exhibitor_id
    AND e.owner_user_id = auth.uid()
  )
  OR is_admin()
);

-- Policy: Only admins can insert/update/delete
CREATE POLICY "Admins can manage premium entitlements"
ON public.premium_entitlements
FOR ALL
USING (is_admin())
WITH CHECK (is_admin());

-- Add comment
COMMENT ON TABLE public.premium_entitlements IS 'Premium access per exhibitor per event. Grant/revoke must use premium-grant/premium-revoke Edge Functions with service role.';