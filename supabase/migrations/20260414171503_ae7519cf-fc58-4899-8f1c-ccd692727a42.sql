
-- Admins can read outreach campaigns
CREATE POLICY "Admins can read outreach campaigns"
ON public.outreach_campaigns
FOR SELECT
TO authenticated
USING (public.is_admin());

-- Admins can update outreach campaigns (for manual exclusion)
CREATE POLICY "Admins can update outreach campaigns"
ON public.outreach_campaigns
FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Admins can read outreach contacts
CREATE POLICY "Admins can read outreach contacts"
ON public.outreach_contacts
FOR SELECT
TO authenticated
USING (public.is_admin());
