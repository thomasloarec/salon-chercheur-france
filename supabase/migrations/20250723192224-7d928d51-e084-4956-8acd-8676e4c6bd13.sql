-- Migration : ajouter une colonne airtable_id pour mapper les records Airtable
ALTER TABLE public.events
ADD COLUMN airtable_id text UNIQUE;