-- 1. Clean verified_at + owner_user_id on test/archived exhibitors
UPDATE exhibitors
SET verified_at = NULL,
    owner_user_id = NULL,
    updated_at = now()
WHERE slug IN ('archived-coveris-group', 'test-reject-e2e', 'test-live-e2e');

-- 2. Remove test team memberships for these 3 exhibitors only
DELETE FROM exhibitor_team_members
WHERE exhibitor_id IN (
  SELECT id FROM exhibitors
  WHERE slug IN ('archived-coveris-group', 'test-reject-e2e', 'test-live-e2e')
);