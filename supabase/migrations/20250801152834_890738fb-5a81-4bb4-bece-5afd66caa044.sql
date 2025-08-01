-- Enable pgcrypto extension (requires SUPERUSER privileges)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Add encrypted token columns to user_crm_connections
ALTER TABLE public.user_crm_connections 
ADD COLUMN access_token_enc bytea,
ADD COLUMN refresh_token_enc bytea;

-- Encrypt existing tokens with a placeholder secret (will be replaced by real secret in production)
-- Note: This migration assumes ENCRYPTION_KEY environment variable is available
UPDATE public.user_crm_connections 
SET 
  access_token_enc = pgp_sym_encrypt(access_token, COALESCE(current_setting('app.encryption_key', true), 'temp-migration-key')),
  refresh_token_enc = CASE 
    WHEN refresh_token IS NOT NULL 
    THEN pgp_sym_encrypt(refresh_token, COALESCE(current_setting('app.encryption_key', true), 'temp-migration-key'))
    ELSE NULL 
  END
WHERE access_token IS NOT NULL;

-- Make encrypted columns NOT NULL after migration
ALTER TABLE public.user_crm_connections 
ALTER COLUMN access_token_enc SET NOT NULL;

-- Drop the old plaintext columns
ALTER TABLE public.user_crm_connections 
DROP COLUMN access_token,
DROP COLUMN refresh_token;