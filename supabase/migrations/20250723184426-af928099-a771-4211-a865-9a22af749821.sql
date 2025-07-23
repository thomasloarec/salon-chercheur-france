-- Migration : ajouter une contrainte UNIQUE sur la colonne urlexpo_event
ALTER TABLE public.participation
ADD CONSTRAINT participation_urlexpo_event_key UNIQUE (urlexpo_event);