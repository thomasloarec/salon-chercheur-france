-- Add is_premium column to novelties table for freemium lead access
ALTER TABLE public.novelties 
ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT FALSE;

-- Add index for faster premium status queries
CREATE INDEX IF NOT EXISTS idx_novelties_premium ON public.novelties(is_premium) WHERE is_premium = TRUE;

-- Add comment for documentation
COMMENT ON COLUMN public.novelties.is_premium IS 'Premium status: TRUE = unlimited leads visible, FALSE = max 3 leads visible (freemium)';