-- ============================================================
-- WF5 — Lot 2 : override admin sur la nature d'un evenement.
--
-- type_event n'est PAS un predicteur fiable de la presence d'exposants :
-- 47% des 'salon' n'ont aucun exposant reference, et 32% des 'congres'
-- en ont. Ces deux colonnes permettent a l'admin de trancher a la main
-- quand la detection automatique est indeterminee.
--
-- NULL = indetermine (comportement par defaut, detection automatique).
-- L'import Airtable n'ecrit jamais ces colonnes : il ne les connait pas.
-- ============================================================

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS expects_exhibitors boolean,
  ADD COLUMN IF NOT EXISTS expects_program    boolean;

COMMENT ON COLUMN public.events.expects_exhibitors IS
  'Override admin. NULL = detection automatique. false = evenement sans exposants (congres, ceremonie) : ne jamais evoquer les exposants dans les emails d''activation.';

COMMENT ON COLUMN public.events.expects_program IS
  'Override admin. NULL = detection automatique. false = evenement sans programme de sessions : ne jamais evoquer le programme.';
