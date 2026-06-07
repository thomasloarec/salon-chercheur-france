-- =====================================================================
-- FONDATION DATA NOUVEAUTÉS (étape 1/2) — ADDITIF UNIQUEMENT
-- =====================================================================

-- ---------------------------------------------------------------------
-- Helper slugify (formalise la convention DÉJÀ utilisée par
-- auto_generate_event_slug : lower + extensions.unaccent + non-alphanum -> '-' + trim)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.slugify(txt text)
RETURNS text
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT trim(both '-' from regexp_replace(
    lower(extensions.unaccent(coalesce(txt, ''))),
    '[^a-z0-9]+', '-', 'g'
  ));
$$;

-- =====================================================================
-- TÂCHE A — slug stable et immuable sur novelties
-- =====================================================================

-- 1. Colonne additive, nullable
ALTER TABLE public.novelties ADD COLUMN IF NOT EXISTS slug text;

-- 2. Backfill des lignes existantes (suffixe id pour garantir l'unicité)
UPDATE public.novelties
SET slug = public.slugify(title) || '-' || left(id::text, 8)
WHERE slug IS NULL;

-- 3. Index unique sur slug
CREATE UNIQUE INDEX IF NOT EXISTS novelties_slug_unique_idx
  ON public.novelties (slug);

-- 4. Trigger : génère si NULL, JAMAIS recalculé une fois défini (immuabilité)
CREATE OR REPLACE FUNCTION public.set_novelty_slug()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.slug IS NULL OR NEW.slug = '' THEN
      NEW.slug := public.slugify(NEW.title) || '-' || left(NEW.id::text, 8);
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    -- immuable : on préserve le slug existant, jamais de recalcul
    IF OLD.slug IS NOT NULL THEN
      NEW.slug := OLD.slug;
    ELSIF NEW.slug IS NULL OR NEW.slug = '' THEN
      NEW.slug := public.slugify(NEW.title) || '-' || left(NEW.id::text, 8);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Nom préfixé 'a_' pour passer AVANT protect_novelty_columns_trigger
-- et update_novelties_updated_at (ordre alphabétique). slug n'étant pas
-- une colonne protégée, l'ordre n'a aucun impact fonctionnel : c'est
-- uniquement pour la lisibilité/déterminisme.
DROP TRIGGER IF EXISTS a_set_novelty_slug ON public.novelties;
CREATE TRIGGER a_set_novelty_slug
  BEFORE INSERT OR UPDATE ON public.novelties
  FOR EACH ROW EXECUTE FUNCTION public.set_novelty_slug();

-- =====================================================================
-- TÂCHE B — vue publique public_novelties
-- =====================================================================
CREATE OR REPLACE VIEW public.public_novelties AS
SELECT
  -- champs sûrs de novelties
  n.id,
  n.slug,
  n.event_id,
  n.exhibitor_id,
  n.title,
  n.type,
  n.reason_1,
  n.reason_2,
  n.reason_3,
  n.audience_tags,
  n.media_urls,
  n.doc_url,
  n.resource_url,
  n.availability,
  n.stand_info,
  n.summary,
  n.details,
  n.images_count,
  n.is_premium,
  n.created_at,
  n.updated_at,
  -- identité publique exposant (maillage)
  ex.public_slug   AS exhibitor_public_slug,
  ex.display_name  AS exhibitor_display_name,
  ex.logo_url      AS exhibitor_logo_url,
  -- événement (maillage)
  ev.slug          AS event_slug,
  ev.nom_event     AS event_name,
  ev.date_debut    AS event_date_debut,
  ev.date_fin      AS event_date_fin,
  ev.ville         AS event_ville,
  -- indexabilité (déjà filtré published + non-test : substance requise)
  (
    (char_length(
       coalesce(n.summary, '') || coalesce(n.details, '') ||
       coalesce(n.reason_1, '') || coalesce(n.reason_2, '') || coalesce(n.reason_3, '')
     ) >= 80)
    OR coalesce(n.images_count, 0) > 0
    OR coalesce(array_length(n.media_urls, 1), 0) > 0
  ) AS seo_indexable
FROM public.novelties n
LEFT JOIN LATERAL (
  SELECT p.public_slug, p.display_name, p.logo_url
  FROM public.public_exhibitor_profiles p
  WHERE p.exhibitor_id = n.exhibitor_id
  LIMIT 1
) ex ON true
LEFT JOIN public.events ev ON ev.id = n.event_id
WHERE n.status = 'published'
  AND coalesce(n.is_test, false) = false;

-- Lecture cohérente avec public_exhibitor_profiles
GRANT SELECT ON public.public_novelties TO anon, authenticated, service_role;