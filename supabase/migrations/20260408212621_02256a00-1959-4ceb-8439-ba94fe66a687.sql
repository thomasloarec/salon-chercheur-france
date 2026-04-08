-- Phase A: Nettoyage verified_at sur fiches test/archivées
UPDATE exhibitors
SET verified_at = NULL, updated_at = now()
WHERE slug IN ('archived-coveris-group', 'test-reject-e2e', 'test-live-e2e')
  AND verified_at IS NOT NULL;