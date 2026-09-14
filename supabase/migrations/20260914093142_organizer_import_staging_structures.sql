-- Lot 1 — Import listes exposants organisateur : structures de staging.
-- Aucune ecriture dans les tables de production. Rollback : DROP TABLE / ALTER DROP COLUMN.

-- ============================================================
-- 1. Refonte de staging_organizer_exhibitors
-- Verifie avant application : 0 ligne, 0 FK entrante, 0 vue dependante.
-- ============================================================

DROP TABLE IF EXISTS public.staging_organizer_exhibitors;

CREATE TABLE public.staging_organizer_exhibitors (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id           uuid NOT NULL REFERENCES public.organizer_exhibitor_imports(id) ON DELETE CASCADE,
  event_id            uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  line_no             integer NOT NULL,

  -- Donnees brutes du fichier, conservees telles quelles pour audit
  raw_id_exposant     text,
  raw_nom             text,
  raw_stand           text,
  raw_website         text,

  -- Donnees normalisees, calculees cote serveur
  nom_normalized      text,
  domain_full         text,
  domain_registrable  text,

  parse_flag          text NOT NULL DEFAULT 'ok'
    CHECK (parse_flag IN ('ok','invalid_url','platform_url','missing_name',
                          'missing_website','duplicate_line','bad_id_exposant',
                          'id_not_yet_synced')),

  -- Resultat du rapprochement
  match_kind          text NOT NULL DEFAULT 'pending'
    CHECK (match_kind IN ('pending','supplied_id','id_conflict','exact_domain',
                          'registrable_domain','name_similarity','ambiguous',
                          'to_create','ignored')),
  matched_id_exposant text,
  match_score         integer CHECK (match_score IS NULL OR (match_score >= 0 AND match_score <= 100)),
  match_reason        text,

  -- Candidat concurrent issu du domaine, renseigne uniquement en cas de id_conflict.
  -- C'est la contre-expertise de la saisie manuelle.
  domain_id_exposant  text,

  planned_action      text
    CHECK (planned_action IS NULL OR planned_action IN ('create','update_stand','unchanged','review','ignore')),

  decided_by          uuid,
  decided_at          timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),

  UNIQUE (import_id, line_no)
);

CREATE INDEX idx_soe_import       ON public.staging_organizer_exhibitors (import_id);
CREATE INDEX idx_soe_event        ON public.staging_organizer_exhibitors (event_id);
CREATE INDEX idx_soe_match_kind   ON public.staging_organizer_exhibitors (import_id, match_kind);
CREATE INDEX idx_soe_domain_reg   ON public.staging_organizer_exhibitors (domain_registrable)
  WHERE domain_registrable IS NOT NULL;

COMMENT ON TABLE public.staging_organizer_exhibitors IS
  'Lignes d''un fichier exposants transmis par un organisateur, normalisees et rapprochees de l''existant. Zone de travail : rien ici n''est visible du public. L''application se fait par organizer_apply_exhibitor_list().';
COMMENT ON COLUMN public.staging_organizer_exhibitors.domain_id_exposant IS
  'Exposant designe par le rapprochement par domaine. Sert de contre-expertise a raw_id_exposant saisi manuellement : un desaccord donne match_kind = id_conflict.';

ALTER TABLE public.staging_organizer_exhibitors ENABLE ROW LEVEL SECURITY;

CREATE POLICY soe_admin_all ON public.staging_organizer_exhibitors
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY soe_service_all ON public.staging_organizer_exhibitors
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- 2. Suivi de cycle de vie sur organizer_exhibitor_imports
-- Les 2 lignes existantes prennent le statut 'uploaded', qui decrit leur etat reel.
-- ============================================================

ALTER TABLE public.organizer_exhibitor_imports
  ADD COLUMN IF NOT EXISTS status      text NOT NULL DEFAULT 'uploaded'
    CHECK (status IN ('uploaded','parsed','matched','applied','cancelled')),
  ADD COLUMN IF NOT EXISTS parsed_at   timestamptz,
  ADD COLUMN IF NOT EXISTS matched_at  timestamptz,
  ADD COLUMN IF NOT EXISTS applied_at  timestamptz,
  ADD COLUMN IF NOT EXISTS applied_by  uuid,
  ADD COLUMN IF NOT EXISTS stats       jsonb;

CREATE INDEX IF NOT EXISTS idx_oei_event_status
  ON public.organizer_exhibitor_imports (event_id, status);

COMMENT ON COLUMN public.organizer_exhibitor_imports.stats IS
  'Compteurs du dernier apercu ou de l''application : create, update_stand, unchanged, missing, review, invalid.';

-- ============================================================
-- 3. Archive des participations retirees
-- Pas de cle etrangere : l''archive doit survivre a la suppression de l''evenement.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.participation_removal_log (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id    uuid,
  id_event     uuid,
  id_exposant  text,
  removed_row  jsonb NOT NULL,
  reason       text,
  removed_by   uuid,
  removed_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prl_event  ON public.participation_removal_log (id_event);
CREATE INDEX IF NOT EXISTS idx_prl_import ON public.participation_removal_log (import_id);

COMMENT ON TABLE public.participation_removal_log IS
  'Archive JSON de toute participation supprimee par un import organisateur. Permet la restauration si l''organisateur a transmis une liste incomplete.';

ALTER TABLE public.participation_removal_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY prl_admin_all ON public.participation_removal_log
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY prl_service_all ON public.participation_removal_log
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
