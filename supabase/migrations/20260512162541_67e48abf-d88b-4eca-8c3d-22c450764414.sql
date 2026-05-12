
-- Cleanup: revoke admin@lotexpo.com's auto-granted ownership on exhibitors
-- whose claim requests were rejected (TRESPA, DIGDASH, ARJO).
WITH bad AS (
  SELECT etm.id AS membership_id, etm.exhibitor_id
  FROM exhibitor_team_members etm
  JOIN auth.users u ON u.id = etm.user_id
  JOIN exhibitor_claim_requests cr
    ON cr.exhibitor_id = etm.exhibitor_id
   AND cr.requester_user_id = etm.user_id
   AND cr.status = 'rejected'
  WHERE u.email = 'admin@lotexpo.com'
    AND etm.status = 'active'
)
UPDATE exhibitor_team_members
SET status = 'removed', updated_at = now()
WHERE id IN (SELECT membership_id FROM bad);

-- Clear verified_at on exhibitors that no longer have any active owner.
UPDATE exhibitors e
SET verified_at = NULL
WHERE e.verified_at IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM exhibitor_team_members etm
    WHERE etm.exhibitor_id = e.id
      AND etm.role = 'owner'
      AND etm.status = 'active'
  );
