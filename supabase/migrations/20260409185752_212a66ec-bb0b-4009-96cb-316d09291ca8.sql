
-- Table for pending invitations (for users who don't have an account yet)
CREATE TABLE public.exhibitor_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  exhibitor_id UUID NOT NULL REFERENCES public.exhibitors(id) ON DELETE CASCADE,
  invited_by UUID NOT NULL REFERENCES auth.users(id),
  role TEXT NOT NULL DEFAULT 'admin',
  token UUID NOT NULL DEFAULT gen_random_uuid(),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '30 days'),
  accepted_at TIMESTAMPTZ
);

-- Index for fast lookup by email
CREATE INDEX idx_exhibitor_invitations_email ON public.exhibitor_invitations(email);
CREATE UNIQUE INDEX idx_exhibitor_invitations_unique_pending ON public.exhibitor_invitations(email, exhibitor_id) WHERE status = 'pending';

-- Enable RLS
ALTER TABLE public.exhibitor_invitations ENABLE ROW LEVEL SECURITY;

-- Admins can see all
CREATE POLICY "Admins can view all invitations"
  ON public.exhibitor_invitations FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Team members can view their exhibitor's invitations
CREATE POLICY "Team members can view own exhibitor invitations"
  ON public.exhibitor_invitations FOR SELECT
  TO authenticated
  USING (public.is_team_member(exhibitor_id));
