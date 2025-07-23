-- Migration pour ajouter une contrainte unique sur urlexpo_event dans la table participation
ALTER TABLE participation
  ADD CONSTRAINT participation_urlexpo_event_unique
  UNIQUE (urlexpo_event);