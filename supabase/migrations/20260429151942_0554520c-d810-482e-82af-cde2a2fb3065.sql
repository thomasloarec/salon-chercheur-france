-- Allow a user to SELECT an exhibitor row when they have a pending claim on it.
-- Root cause: when exhibitor-claim-bridge creates a brand-new exhibitor (approved=false),
-- the public read policy denies SELECT to the requester, breaking:
--  - useExhibitorGovernance UUID resolution (popup button stays as "Devenir gestionnaire")
--  - useMyPendingClaims join with exhibitors (pending claim hidden in profile)

CREATE POLICY "Requesters can view exhibitors they have a pending claim on"
ON public.exhibitors
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.exhibitor_claim_requests cr
    WHERE cr.exhibitor_id = exhibitors.id
      AND cr.requester_user_id = auth.uid()
      AND cr.status = 'pending'
  )
);