UPDATE exhibitors
SET verified_at = NULL,
    owner_user_id = NULL,
    updated_at = now()
WHERE slug IN ('archived-coveris-group', 'test-reject-e2e', 'test-live-e2e');