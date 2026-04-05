-- ============================================================
-- wizard_sessions: restrict UPDATE to session owner
-- ============================================================
-- RISK DOCUMENTATION:
-- For anonymous sessions (user_id IS NULL), the UPDATE policy remains open.
-- This is an accepted residual risk because:
-- 1. The session UUID v4 is server-generated (gen_random_uuid()) and never exposed publicly
-- 2. The client only knows its own session ID (returned from INSERT, stored in React state)
-- 3. Brute-forcing a UUID v4 is computationally infeasible
-- 4. The data in wizard_sessions is non-sensitive (step progression, keywords, duration)
--
-- FUTURE MITIGATION: If wizard_sessions evolves to store sensitive data,
-- add an anonymous_token column (server-generated, returned with INSERT)
-- and require it in the UPDATE policy.
-- ============================================================

DROP POLICY "Anyone can update wizard sessions" ON public.wizard_sessions;

CREATE POLICY "Session owner can update"
ON public.wizard_sessions
FOR UPDATE
USING (
  (user_id IS NOT NULL AND user_id = auth.uid())
  OR (user_id IS NULL)
);