-- =========================================================
-- Phase 2C (V2) : linkedin_url (page entreprise uniquement) + maj vue
-- =========================================================

-- 1. Colonne nullable
ALTER TABLE public.exhibitors
  ADD COLUMN IF NOT EXISTS linkedin_url text;

COMMENT ON COLUMN public.exhibitors.linkedin_url IS
  'URL LinkedIn officielle (page entreprise) de l''exposant (champ editorial public, editable par owner). '
  'NULL autorise. Doit etre https:// + host linkedin.com ou *.linkedin.com + chemin /company/... ou /showcase/... '
  '(contrainte chk_exhibitors_linkedin_url). Les profils /in/, /posts/, /jobs/ sont refuses.';

-- 2. Normalisation (trim + chaine vide -> NULL) AVANT validation de la contrainte
CREATE OR REPLACE FUNCTION public.normalize_exhibitor_linkedin_url()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  NEW.linkedin_url := NULLIF(btrim(NEW.linkedin_url), '');
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS normalize_exhibitor_linkedin_url_trigger ON public.exhibitors;
CREATE TRIGGER normalize_exhibitor_linkedin_url_trigger
  BEFORE INSERT OR UPDATE OF linkedin_url ON public.exhibitors
  FOR EACH ROW
  EXECUTE FUNCTION public.normalize_exhibitor_linkedin_url();

-- 3. Contrainte stricte V2 : NULL ok, sinon https:// + host linkedin.com|*.linkedin.com
--    + chemin /company/<x> ou /showcase/<x> (au moins 1 caractere apres le slash).
--    ~* = insensible a la casse. ([a-z0-9-]+\.)* autorise les sous-domaines officiels.
--    Exiger 'linkedin\.com/(company|showcase)/' empeche linkedin.com.fake-domain.com
--    et linkedin.fake-domain.com, ainsi que /in/, /posts/, /jobs/.
ALTER TABLE public.exhibitors
  DROP CONSTRAINT IF EXISTS chk_exhibitors_linkedin_url;
ALTER TABLE public.exhibitors
  ADD CONSTRAINT chk_exhibitors_linkedin_url
  CHECK (
    linkedin_url IS NULL
    OR linkedin_url ~* '^https://([a-z0-9-]+\.)*linkedin\.com/(company|showcase)/.+'
  );

-- 4. Mise a jour de la vue (mode DEFINER conserve, aucune autre logique modifiee)
CREATE OR REPLACE VIEW public.public_exhibitor_profiles AS
WITH base AS (
         SELECT epi.id AS public_identity_id,
            epi.public_slug,
            epi.source_type,
            epi.is_active,
            epi.legacy_exposant_id,
            epi.exhibitor_id,
            epi.canonical_name,
            epi.created_at,
            epi.updated_at,
            COALESCE(NULLIF(btrim(ex.name), ''::text), NULLIF(btrim(le.nom_exposant), ''::text), NULLIF(btrim(epi.canonical_name), ''::text), 'Exposant #'::text || epi.public_slug) AS display_name,
            COALESCE(NULLIF(btrim(ex.website), ''::text), NULLIF(btrim(le.website_exposant), ''::text)) AS website,
            NULLIF(btrim(ex.logo_url), ''::text) AS logo_url,
            COALESCE(NULLIF(btrim(ex.description), ''::text), NULLIF(btrim(le.exposant_description), ''::text), NULLIF(btrim(ai.resume_court), ''::text)) AS description,
            NULLIF(btrim(ai.resume_court), ''::text) AS ai_summary,
            NULLIF(btrim(ex.linkedin_url), ''::text) AS linkedin_url,
            ex.owner_user_id IS NOT NULL OR COALESCE(tm.active_team_count, 0::bigint) > 0 AS is_claimed,
            COALESCE(ex.approved, false) = true OR ex.verified_at IS NOT NULL AS is_verified,
            COALESCE(ex.is_test, false) OR COALESCE(epi.canonical_name, ''::text) ~~* '\_\_%'::text OR COALESCE(ex.name, ''::text) ~~* '\_\_%'::text OR COALESCE(le.nom_exposant, ''::text) ~~* '\_\_%'::text OR epi.public_slug ~~ 't2abis-%'::text AS is_test,
            COALESCE(part.total_participations, 0::bigint) AS total_participations,
            COALESCE(part.future_participations_count, 0::bigint) AS future_participations_count,
            COALESCE(part.past_participations_count, 0::bigint) AS past_participations_count,
            part.next_event_at,
            part.last_past_event_at,
            COALESCE(nov.published_novelties_count, 0::bigint) AS published_novelties_count,
            nov.last_novelty_at,
            ex.updated_at AS exhibitor_updated_at
           FROM exhibitor_public_identities epi
             LEFT JOIN exhibitors ex ON ex.id = epi.exhibitor_id
             LEFT JOIN exposants le ON le.id_exposant = epi.legacy_exposant_id
             LEFT JOIN LATERAL ( SELECT ai0.resume_court
                   FROM exhibitor_ai ai0
                  WHERE epi.exhibitor_id IS NOT NULL AND ai0.exhibitor_id = epi.exhibitor_id::text OR epi.legacy_exposant_id IS NOT NULL AND ai0.exhibitor_id = epi.legacy_exposant_id
                 LIMIT 1) ai ON true
             LEFT JOIN LATERAL ( SELECT count(*) AS active_team_count
                   FROM exhibitor_team_members t
                  WHERE epi.exhibitor_id IS NOT NULL AND t.exhibitor_id = epi.exhibitor_id AND t.status = 'active'::exhibitor_team_status) tm ON true
             LEFT JOIN LATERAL ( SELECT count(DISTINCT p.id_participation) AS total_participations,
                    count(DISTINCT p.id_participation) FILTER (WHERE COALESCE(e.date_fin, e.date_debut) >= CURRENT_DATE) AS future_participations_count,
                    count(DISTINCT p.id_participation) FILTER (WHERE COALESCE(e.date_fin, e.date_debut) < CURRENT_DATE) AS past_participations_count,
                    min(e.date_debut) FILTER (WHERE COALESCE(e.date_fin, e.date_debut) >= CURRENT_DATE) AS next_event_at,
                    max(COALESCE(e.date_fin, e.date_debut)) FILTER (WHERE COALESCE(e.date_fin, e.date_debut) < CURRENT_DATE) AS last_past_event_at
                   FROM participation p
                     JOIN events e ON e.id = p.id_event
                  WHERE e.visible = true AND e.is_test = false AND (epi.legacy_exposant_id IS NOT NULL AND p.id_exposant = epi.legacy_exposant_id OR epi.exhibitor_id IS NOT NULL AND p.exhibitor_id = epi.exhibitor_id)) part ON true
             LEFT JOIN LATERAL ( SELECT count(*) AS published_novelties_count,
                    max(n.updated_at) AS last_novelty_at
                   FROM novelties n
                  WHERE epi.exhibitor_id IS NOT NULL AND n.exhibitor_id = epi.exhibitor_id AND n.status = 'published'::text AND COALESCE(n.is_test, false) = false) nov ON true
          WHERE epi.is_active = true
        )
 SELECT public_identity_id,
    public_slug,
    source_type,
    is_active,
    legacy_exposant_id,
    exhibitor_id,
    display_name,
    canonical_name,
    website,
    logo_url,
    description,
    ai_summary,
    linkedin_url,
    is_claimed,
    is_verified,
    is_test,
    total_participations,
    future_participations_count,
    past_participations_count,
    published_novelties_count,
    future_participations_count > 0 AS has_future_events,
    published_novelties_count > 0 AS has_published_novelties,
    website IS NOT NULL AS has_website,
    description IS NOT NULL AS has_description,
    logo_url IS NOT NULL AS has_logo,
        CASE
            WHEN is_claimed THEN true
            WHEN published_novelties_count >= 1 THEN true
            WHEN future_participations_count >= 2 THEN true
            WHEN future_participations_count >= 1 AND description IS NOT NULL AND website IS NOT NULL THEN true
            WHEN exhibitor_id IS NOT NULL AND length(COALESCE(description, ''::text)) >= 120 THEN true
            ELSE false
        END AS seo_indexable,
        CASE
            WHEN is_claimed THEN 'claimed'::text
            WHEN published_novelties_count >= 1 THEN 'published_novelty'::text
            WHEN future_participations_count >= 2 THEN 'multiple_future_events'::text
            WHEN future_participations_count >= 1 AND description IS NOT NULL AND website IS NOT NULL THEN 'future_event_with_content'::text
            WHEN exhibitor_id IS NOT NULL AND length(COALESCE(description, ''::text)) >= 120 THEN 'enriched_profile'::text
            ELSE 'thin_content'::text
        END AS seo_reason,
    LEAST(COALESCE(last_novelty_at, last_past_event_at::timestamp with time zone, exhibitor_updated_at, updated_at, created_at), now()) AS last_activity_at,
    next_event_at,
    created_at,
    updated_at
   FROM base;

COMMENT ON VIEW public.public_exhibitor_profiles IS
  'Phase 2B/2C - Couche de lecture publique unifiee des exposants (mode DEFINER, owner=postgres BYPASSRLS). '
  'Expose uniquement des colonnes non sensibles. linkedin_url = NULLIF(BTRIM(exhibitors.linkedin_url),'''') (Phase 2C V2, page entreprise uniquement). '
  'next_event_at inclut les salons en cours OU futurs (COALESCE(date_fin,date_debut) >= CURRENT_DATE). '
  'seo_indexable est calcule a la volee (dynamique, aucun cron requis).';