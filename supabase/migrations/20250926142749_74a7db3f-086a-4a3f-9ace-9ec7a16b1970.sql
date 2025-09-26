-- Migration idempotente pour corriger l'import des participations
-- Contrainte unique sur urlexpo_event pour la déduplication
CREATE UNIQUE INDEX IF NOT EXISTS participations_urlexpo_event_key
  ON participation (urlexpo_event);

-- Index pour accélérer la résolution UUID événement depuis Event_XX  
CREATE INDEX IF NOT EXISTS events_id_event_idx
  ON events (id_event);