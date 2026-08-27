-- =====================================================================
-- Chantier A : ajout de la raison 'complaint' a email_blacklist
-- Date      : 2026-08-26
-- Appliquee : OUI (via Supabase apply_migration, projet vxivdvzzhebobveedxbj)
-- Objet     : contrainte email_blacklist_reason_check
-- =====================================================================
-- Additif : le nouvel ensemble est un sur-ensemble de l'ancien.
-- Toutes les lignes existantes restent valides. Rien a valider.
-- Necessaire pour que la fonction resend-webhook puisse enregistrer
-- les plaintes spam (email.complained) avec reason='complaint'.
-- Les rebonds durs utilisent reason='bounce', deja autorise.
-- =====================================================================

ALTER TABLE public.email_blacklist DROP CONSTRAINT email_blacklist_reason_check;

ALTER TABLE public.email_blacklist ADD CONSTRAINT email_blacklist_reason_check
  CHECK (reason = ANY (ARRAY['invalid_address'::text, 'opt_out_global'::text, 'manual'::text, 'bounce'::text, 'complaint'::text]));
