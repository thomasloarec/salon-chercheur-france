-- ============================================================================
-- VÉRIFICATION ET CORRECTION DE LA VUE participations_with_exhibitors
-- ============================================================================

-- Supprimer l'ancienne vue si elle existe
DROP VIEW IF EXISTS participations_with_exhibitors CASCADE;

-- Recréer la vue avec TOUTES les colonnes nécessaires incluant description
CREATE OR REPLACE VIEW participations_with_exhibitors AS
SELECT 
  p.id_participation,
  p.id_event,
  p.id_event_text,
  p.stand_exposant,
  p.urlexpo_event,
  p.id_exposant,
  p.exhibitor_id,
  
  -- ✅ COLONNES DEPUIS EXHIBITORS (moderne)
  ex.id as exhibitor_uuid,
  ex.name as exhibitor_name,
  ex.website as exhibitor_website,
  ex.description as modern_description,
  ex.logo_url,
  ex.approved,
  ex.plan,
  ex.stand_info,
  
  -- ✅ COLONNES DEPUIS EXPOSANTS (legacy)
  old.nom_exposant as legacy_name,
  old.website_exposant as legacy_website,
  old.exposant_description as legacy_description,
  
  -- ✅ COLONNES FALLBACK AVEC PRIORITÉ (moderne en premier)
  COALESCE(ex.name, old.nom_exposant) as name_final,
  COALESCE(ex.website, old.website_exposant, p.website_exposant) as website_final,
  COALESCE(ex.description, old.exposant_description) as description_final,
  
  -- ✅ COLONNES LEGACY POUR COMPATIBILITÉ FRONTEND
  COALESCE(old.website_exposant, p.website_exposant) as website_exposant,
  COALESCE(old.exposant_description, ex.description) as exposant_description,
  p.website_exposant as participation_website
  
FROM participation p

-- JOIN exhibitors (moderne) via exhibitor_id
LEFT JOIN exhibitors ex ON ex.id = p.exhibitor_id

-- JOIN exposants (legacy) via id_exposant
LEFT JOIN exposants old ON old.id_exposant = p.id_exposant;

-- ============================================================================
-- Créer un index pour améliorer les performances
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_participation_exhibitor_id ON participation(exhibitor_id);
CREATE INDEX IF NOT EXISTS idx_participation_id_exposant ON participation(id_exposant);

-- ============================================================================
-- Commentaires pour documentation
-- ============================================================================

COMMENT ON VIEW participations_with_exhibitors IS 
'Vue unifiée combinant les données des tables participation, exhibitors (moderne) et exposants (legacy).
Priorité : exhibitors.description > exposants.exposant_description
Cette vue garantit que les descriptions des nouveaux exposants sont correctement récupérées.';
