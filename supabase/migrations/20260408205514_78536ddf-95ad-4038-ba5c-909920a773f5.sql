
-- Allow public read of verified_at for the badge
GRANT SELECT (verified_at) ON public.exhibitors TO anon, authenticated;
