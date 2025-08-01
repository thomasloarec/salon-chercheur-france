-- Tenter de déplacer les extensions vers le schéma extensions
-- Attention: cela pourrait échouer si des objets dépendent de ces extensions

-- Déplacer l'extension pg_trgm vers le schéma extensions
ALTER EXTENSION pg_trgm SET SCHEMA extensions;

-- Déplacer l'extension unaccent vers le schéma extensions  
ALTER EXTENSION unaccent SET SCHEMA extensions;