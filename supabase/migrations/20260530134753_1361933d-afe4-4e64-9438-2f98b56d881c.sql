-- =========================================================
-- Phase 2D — Analytics foundation: exhibitor_events
-- =========================================================

-- 1. Table
CREATE TABLE public.exhibitor_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_identity_id uuid REFERENCES public.exhibitor_public_identities(id) ON DELETE SET NULL,
  public_slug text NOT NULL,
  event_type text NOT NULL,
  user_id uuid NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),

  -- 2. Allowed event types (closed list V1)
  CONSTRAINT exhibitor_events_event_type_check CHECK (
    event_type IN (
      'profile_view',
      'website_click',
      'linkedin_click',
      'event_click',
      'novelty_click',
      'brochure_click',
      'brochure_download',
      'claim_click',
      'full_profile_click',
      'alert_activate',
      'alert_deactivate'
    )
  ),

  -- 3. metadata must be a JSON object, kept lightweight
  CONSTRAINT exhibitor_events_metadata_object_check CHECK (
    jsonb_typeof(metadata) = 'object'
  ),
  -- Reasonable size guard to avoid abuse / bloat (~4KB)
  CONSTRAINT exhibitor_events_metadata_size_check CHECK (
    pg_column_size(metadata) <= 4096
  ),

  -- public_slug must be non-empty
  CONSTRAINT exhibitor_events_public_slug_not_blank CHECK (
    length(btrim(public_slug)) > 0
  )
);

COMMENT ON TABLE public.exhibitor_events IS
  'Phase 2D: analytics events for public exhibitor profiles (/exposants/:slug). public_slug is denormalized and historized so events remain exploitable even if public_identity_id becomes NULL. No PII, no IP, no email stored.';

-- 4. Indexes
CREATE INDEX idx_exhibitor_events_identity_created
  ON public.exhibitor_events (public_identity_id, created_at DESC);
CREATE INDEX idx_exhibitor_events_slug_created
  ON public.exhibitor_events (public_slug, created_at DESC);
CREATE INDEX idx_exhibitor_events_type_created
  ON public.exhibitor_events (event_type, created_at DESC);
CREATE INDEX idx_exhibitor_events_created
  ON public.exhibitor_events (created_at DESC);
CREATE INDEX idx_exhibitor_events_user_created
  ON public.exhibitor_events (user_id, created_at DESC)
  WHERE user_id IS NOT NULL;

-- 5. GRANTS
-- No anon/authenticated direct access: writes go through the RPC only.
-- service_role for admin/edge code; reads handled by RLS policy below.
GRANT SELECT ON public.exhibitor_events TO authenticated;
GRANT ALL ON public.exhibitor_events TO service_role;

-- 6. RLS
ALTER TABLE public.exhibitor_events ENABLE ROW LEVEL SECURITY;

-- Admins can read all events.
CREATE POLICY "Admins can read exhibitor events"
ON public.exhibitor_events
FOR SELECT
TO authenticated
USING (public.is_admin());

-- service_role full management (bypasses RLS anyway, explicit for clarity).
CREATE POLICY "Service role manages exhibitor events"
ON public.exhibitor_events
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- No INSERT/UPDATE/DELETE policy for anon/authenticated:
-- public writes happen exclusively via track_exhibitor_event (SECURITY DEFINER).

-- 7. Tracking RPC
CREATE OR REPLACE FUNCTION public.track_exhibitor_event(
  p_public_slug text,
  p_event_type text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_slug text;
  v_identity_id uuid;
  v_metadata jsonb;
BEGIN
  -- Normalize slug
  v_slug := nullif(btrim(coalesce(p_public_slug, '')), '');
  IF v_slug IS NULL THEN
    RETURN false;
  END IF;

  -- Validate event type against the allowed list
  IF p_event_type IS NULL OR p_event_type NOT IN (
      'profile_view',
      'website_click',
      'linkedin_click',
      'event_click',
      'novelty_click',
      'brochure_click',
      'brochure_download',
      'claim_click',
      'full_profile_click',
      'alert_activate',
      'alert_deactivate'
  ) THEN
    RETURN false;
  END IF;

  -- Validate metadata is a JSON object (default to empty object)
  v_metadata := coalesce(p_metadata, '{}'::jsonb);
  IF jsonb_typeof(v_metadata) <> 'object' THEN
    RETURN false;
  END IF;

  -- Resolve active public identity for this slug
  SELECT id INTO v_identity_id
  FROM public.exhibitor_public_identities
  WHERE public_slug = v_slug
    AND is_active = true
  LIMIT 1;

  -- Unknown or inactive slug: do not block the UI, just report false
  IF v_identity_id IS NULL THEN
    RETURN false;
  END IF;

  INSERT INTO public.exhibitor_events (
    public_identity_id,
    public_slug,
    event_type,
    user_id,
    metadata
  ) VALUES (
    v_identity_id,
    v_slug,
    p_event_type,
    auth.uid(),
    v_metadata
  );

  RETURN true;
EXCEPTION
  WHEN OTHERS THEN
    -- Never break the public UI because of analytics
    RETURN false;
END;
$$;

COMMENT ON FUNCTION public.track_exhibitor_event(text, text, jsonb) IS
  'Phase 2D: secure tracking entrypoint for public exhibitor profile analytics. Validates active slug, event_type and metadata; inserts into exhibitor_events with auth.uid() (or NULL for anon). Returns false (non-blocking) on any invalid input.';

-- 8. Execute grants on the RPC
REVOKE ALL ON FUNCTION public.track_exhibitor_event(text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.track_exhibitor_event(text, text, jsonb) TO anon;
GRANT EXECUTE ON FUNCTION public.track_exhibitor_event(text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.track_exhibitor_event(text, text, jsonb) TO service_role;