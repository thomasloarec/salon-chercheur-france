-- Créer une table générique pour les erreurs d'import avec support de tracking
DROP TABLE IF EXISTS public.import_errors;

CREATE TABLE public.import_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Identifiant de la session d'import (pour grouper les erreurs d'un même import)
  import_session_id uuid NOT NULL,
  -- Type d'entité concernée: 'event', 'exposant', 'participation'
  entity_type text NOT NULL CHECK (entity_type IN ('event', 'exposant', 'participation')),
  -- Identifiant Airtable du record
  airtable_record_id text NOT NULL,
  -- Catégorie d'erreur pour regroupement
  error_category text NOT NULL,
  -- Raison détaillée de l'erreur
  error_reason text NOT NULL,
  -- Données supplémentaires pour diagnostic
  context_data jsonb DEFAULT '{}',
  -- Tracking: l'erreur a-t-elle été traitée?
  resolved boolean DEFAULT false,
  -- Date de résolution
  resolved_at timestamp with time zone,
  -- Qui a résolu
  resolved_by uuid REFERENCES auth.users(id),
  -- Horodatage
  created_at timestamp with time zone DEFAULT now()
);

-- Index pour performances
CREATE INDEX idx_import_errors_session ON public.import_errors(import_session_id);
CREATE INDEX idx_import_errors_type ON public.import_errors(entity_type);
CREATE INDEX idx_import_errors_resolved ON public.import_errors(resolved);
CREATE INDEX idx_import_errors_category ON public.import_errors(error_category);

-- Table pour stocker les sessions d'import
CREATE TABLE public.import_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamp with time zone DEFAULT now(),
  completed_at timestamp with time zone,
  -- Résumé de l'import
  events_imported integer DEFAULT 0,
  exposants_imported integer DEFAULT 0,
  participations_imported integer DEFAULT 0,
  -- Compteurs d'erreurs
  events_errors integer DEFAULT 0,
  exposants_errors integer DEFAULT 0,
  participations_errors integer DEFAULT 0,
  -- Qui a lancé l'import
  created_by uuid REFERENCES auth.users(id),
  -- Statut: 'running', 'completed', 'failed'
  status text DEFAULT 'running'
);

-- RLS pour import_errors
ALTER TABLE public.import_errors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage import errors"
ON public.import_errors
FOR ALL
USING (is_admin())
WITH CHECK (is_admin());

CREATE POLICY "Service role can manage import errors"
ON public.import_errors
FOR ALL
USING (auth.role() = 'service_role');

-- RLS pour import_sessions
ALTER TABLE public.import_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view import sessions"
ON public.import_sessions
FOR SELECT
USING (is_admin());

CREATE POLICY "Service role can manage import sessions"
ON public.import_sessions
FOR ALL
USING (auth.role() = 'service_role');