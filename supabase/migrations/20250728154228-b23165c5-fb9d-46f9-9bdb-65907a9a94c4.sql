-- Vérifier si la table staging_events_import existe déjà
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name = 'staging_events_import';